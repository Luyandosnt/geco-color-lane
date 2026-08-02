FROM node:20-bookworm AS apk-builder

ENV DEBIAN_FRONTEND=noninteractive
ENV ANDROID_HOME=/opt/android-sdk
ENV ANDROID_SDK_ROOT=/opt/android-sdk
ENV PATH="${PATH}:${ANDROID_HOME}/cmdline-tools/latest/bin:${ANDROID_HOME}/platform-tools"

RUN apt-get update \
    && apt-get install -y --no-install-recommends openjdk-17-jdk wget unzip ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p ${ANDROID_HOME}/cmdline-tools \
    && wget -q https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -O /tmp/android-tools.zip \
    && unzip -q /tmp/android-tools.zip -d /tmp/android-tools \
    && mkdir -p ${ANDROID_HOME}/cmdline-tools/latest \
    && mv /tmp/android-tools/cmdline-tools/* ${ANDROID_HOME}/cmdline-tools/latest/ \
    && rm -rf /tmp/android-tools /tmp/android-tools.zip

RUN yes | sdkmanager --licenses >/dev/null \
    && sdkmanager "platform-tools" "platforms;android-35" "build-tools;35.0.0"

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci \
    && npm install --no-save @capacitor/core @capacitor/cli @capacitor/android

COPY . .

RUN npm run build \
    && rm -rf android \
    && npx cap add android \
    && npx cap sync android \
    && chmod +x android/gradlew \
    && cd android \
    && ./gradlew --no-daemon --stacktrace assembleDebug \
    && mkdir -p /output \
    && cp app/build/outputs/apk/debug/app-debug.apk /output/Inshimu-Origins-debug.apk \
    && sha256sum /output/Inshimu-Origins-debug.apk > /output/Inshimu-Origins-debug.apk.sha256

FROM node:20-alpine AS runtime

WORKDIR /app
COPY render-apk-server.mjs ./render-apk-server.mjs
COPY --from=apk-builder /output ./public

ENV PORT=10000
EXPOSE 10000

CMD ["node", "render-apk-server.mjs"]
