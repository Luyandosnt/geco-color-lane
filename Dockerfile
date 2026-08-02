FROM node:22-bookworm AS apk-builder

ENV DEBIAN_FRONTEND=noninteractive
ENV ANDROID_HOME=/opt/android-sdk
ENV ANDROID_SDK_ROOT=/opt/android-sdk
ENV JAVA_HOME=/opt/java/openjdk
ENV PATH="${JAVA_HOME}/bin:${PATH}:${ANDROID_HOME}/cmdline-tools/latest/bin:${ANDROID_HOME}/platform-tools"

RUN apt-get update \
    && apt-get install -y --no-install-recommends wget unzip ca-certificates tar gzip \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /opt/java/openjdk \
    && wget -q --show-progress --progress=dot:giga \
      https://api.adoptium.net/v3/binary/latest/21/ga/linux/x64/jdk/hotspot/normal/eclipse \
      -O /tmp/temurin21.tar.gz \
    && tar -xzf /tmp/temurin21.tar.gz -C /opt/java/openjdk --strip-components=1 \
    && rm /tmp/temurin21.tar.gz \
    && java -version

RUN mkdir -p ${ANDROID_HOME}/cmdline-tools \
    && wget -q https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -O /tmp/android-tools.zip \
    && unzip -q /tmp/android-tools.zip -d /tmp/android-tools \
    && mkdir -p ${ANDROID_HOME}/cmdline-tools/latest \
    && mv /tmp/android-tools/cmdline-tools/* ${ANDROID_HOME}/cmdline-tools/latest/ \
    && rm -rf /tmp/android-tools /tmp/android-tools.zip

RUN yes | sdkmanager --licenses >/dev/null \
    && sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0"

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci \
    && npm install --no-save @capacitor/core@8 @capacitor/cli@8 @capacitor/android@8

COPY . .

RUN node --version \
    && java -version \
    && npm run build \
    && find dist -type f -path '*/Sprites/GameUI/Limited Time*PREMIUM OFFER*.png' -print -delete \
    && rm -rf android \
    && npx cap add android \
    && npx cap sync android \
    && chmod +x android/gradlew \
    && cd android \
    && ./gradlew --no-daemon --stacktrace assembleDebug \
    && mkdir -p /output \
    && cp app/build/outputs/apk/debug/app-debug.apk /output/Inshimu-Origins-debug.apk \
    && sha256sum /output/Inshimu-Origins-debug.apk > /output/Inshimu-Origins-debug.apk.sha256

FROM node:22-alpine AS runtime

WORKDIR /app
COPY render-apk-server.mjs ./render-apk-server.mjs
COPY --from=apk-builder /output ./public

ENV PORT=10000
EXPOSE 10000

CMD ["node", "render-apk-server.mjs"]
