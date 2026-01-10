const fs = require("fs");
const path = require("path");

const logDir = path.join(__dirname, "..", "logs");
fs.mkdirSync(logDir, { recursive: true });

let currentDate = new Date().toISOString().slice(0, 10);
let stream = fs.createWriteStream(path.join(logDir, `app-${currentDate}.log`), {
  flags: "a",
});

function rotateIfNeeded() {
  const nowDate = new Date().toISOString().slice(0, 10);
  if (nowDate !== currentDate) {
    stream.end();
    currentDate = nowDate;
    stream = fs.createWriteStream(path.join(logDir, `app-${currentDate}.log`), {
      flags: "a",
    });
  }
}

function normalizeMeta(meta) {
  if (!meta) {
    return undefined;
  }
  if (meta instanceof Error) {
    return { error: { message: meta.message, stack: meta.stack } };
  }
  if (meta.error instanceof Error) {
    return {
      ...meta,
      error: { message: meta.error.message, stack: meta.error.stack },
    };
  }
  return meta;
}

function log(level, message, meta) {
  rotateIfNeeded();
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...normalizeMeta(meta),
  };
  stream.write(`${JSON.stringify(entry)}\n`);
}

const logger = {
  info: (message, meta) => log("info", message, meta),
  warn: (message, meta) => log("warn", message, meta),
  error: (message, meta) => log("error", message, meta),
};

module.exports = logger;
