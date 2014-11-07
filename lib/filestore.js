var EventEmitter = require("events").EventEmitter,
    fs = require("fs");

module.exports = filestore;

filestore.defaultBufferSize = 4096;
filestore.defaultDelimiter = "\n";
filestore.defaultAllowAnatomicWrites = true;

function filestore(file, cb) {
    var cbQueue = [],
        delimiter = filestore.defaultDelimiter,
        midFlush = false,
        store,
        queue = [];

    store = {
        save : save,
        bufferSize : filestore.defaultBufferSize,
        allowAnatomicWrites : filestore.defaultAllowAnatomicWrites
    };

    // as store is an object literal, extend manually
    Object.keys(EventEmitter.prototype).forEach(function (method) {
        store[method] = EventEmitter.prototype[method];
    });

    if (cb) {
        store.once("ready", cb);
    }

    // prevent "uncaught error" exception
    store.on("error", function () {});

    // append empty string to create the file if it doesn't exist
    queue.push("");
    cbQueue.push(function (err) {
        store.emit("ready", err, store);
    });
    flush();

    return store;

    function flush() {
        var callbacks,
            numToAppend = 1,
            lengthOfAppend,
            strToAppend;

        if (midFlush) {
            return;
        }

        if (!queue.length) {
            store.emit("drain");
            return;
        }

        midFlush = true;
        lengthOfAppend = queue[0].length;

        while (numToAppend < queue.length && lengthOfAppend +
                Buffer.byteLength(queue[numToAppend]) <= store.bufferSize) {
            lengthOfAppend += Buffer.byteLength(queue[numToAppend]);
            numToAppend++;
        }

        callbacks = cbQueue.splice(0, numToAppend);
        strToAppend = queue.splice(0, numToAppend).join();

        fs.appendFile(file, strToAppend, function (err) {
            if (err) {
                store.emit("error", err);
            }
            callbacks.forEach(function (cb) {
                if (cb) {
                    cb(err);
                }
            });
            midFlush = false;
            flush();
        });
    }

    function save(obj, cb) {
        var len;
        len = Buffer.byteLength(obj + delimiter);
        if (!store.allowAnatomicWrites && len > store.bufferSize) {
            store.emit("error");
            return;
        }
        queue.push(obj + delimiter);
        cbQueue.push(cb);
        flush();
    }
}