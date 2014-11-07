var Chance = require("chance").Chance,
    injectr = require("injectr"),
    pretendr = require("pretendr"),
    expect = require("expect.js");

Chance.prototype.mixin({
    path : function () {
        var delimiter = "/",
            path = [],
            poolCaps = "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
            poolLower,
            poolNumbers = "0123456789",
            relative = this.bool(),
            stages = this.natural({
                min : 1,
                max : 8
            }),
            windowsStyle = this.bool();
        poolLower = poolCaps.toLowerCase();

        if (relative) {
            path.push(this.pick([".", ".."]));
        } else if (windowsStyle) {
            path.push(this.character({
                pool : poolCaps,
            }) + ":");
        } else {
            path.push("");
        }
        while (stages--) {
            path.push(this.string({
                pool : poolCaps + poolLower + poolNumbers
            }));
        }
        return path.join(delimiter);
    }
});

describe("filestore", function () {
    var cb,
        filestore,
        mockFs,
        mockBuffer,
        random;
    beforeEach(function () {
        var bufferDescriptor,
            i,
            testName = this.currentTest.title,
            seed = 0;
        mockFs = pretendr({
            appendFile : function () {},
            open : function () {},
            read : function () {},
            stat : function () {}
        });
        bufferDescriptor = function () {};
        bufferDescriptor.byteLength = function () {};
        mockBuffer = pretendr(bufferDescriptor);
        filestore = injectr("../lib/filestore.js", {
            fs : mockFs.mock
        }, {
            Buffer : mockBuffer.mock
        });
        cb = pretendr(function () {});
        i = testName.length;
        while (i--) {
            seed += i * testName.charCodeAt(i);
        }
        random = new Chance(seed);
    });
    it("has a default buffer size", function () {
        expect(filestore).to.have.property("defaultBufferSize", 4096);
    });
    it("has a default delimiter", function () {
        expect(filestore).to.have.property("defaultDelimiter", "\n");
    });
    it("allows anatomic writes by default", function () {
        expect(filestore).to.have.property("defaultAllowAnatomicWrites", true);
    });
    it("sets the bufferSize to the default", function () {
        var bufferSize = random.natural({
            max : 32678
        });
        filestore.defaultBufferSize = bufferSize;
        expect(filestore()).to.have.property("bufferSize", bufferSize);
    });
    it("sets the allow anatomic writes to the default", function () {
        filestore.defaultAllowAnatomicWrites = random.bool();
        expect(filestore()).to.have.property("allowAnatomicWrites",
            filestore.defaultAllowAnatomicWrites);
    });
    it("creates a file if it doesn't exist", function () {
        var filepath = random.path();
        filestore(filepath);
        expect(mockFs.appendFile.calls[0].args).to.have.property(0, filepath)
            .and.to.have.property(1, "");
    });
    it("passes any append error to the supplied callback", function () {
        var err = {};
        filestore(random.string(), cb.mock);
        mockFs.appendFile.calls[0].callback(err);
        expect(cb.calls[0].args).to.have.property(0, err);
    });
    it("passes the store to the callback", function () {
        var store = filestore(random.path(), cb.mock);
        mockFs.appendFile.calls[0].callback();
        expect(cb.calls[0].args).to.have.property(1, store);
    });
    it("emits a 'ready' event", function () {
        var store = filestore();
        store.on("ready", cb.mock);
        mockFs.appendFile.calls[0].callback();
        expect(cb.calls).to.have.length(1);
    });
    it("emits an 'error' event if there is an append error", function () {
        var err = {},
            store = filestore();
        store.on("error", cb.mock);
        mockFs.appendFile.calls[0].callback(err);
        expect(cb.calls[0].args).to.have.property(0, err);
    });
    it("emits no 'error' if everything is ok", function () {
        var store = filestore();
        store.on("error", cb.mock);
        mockFs.appendFile.calls[0].callback(null);
        expect(cb.calls).to.have.length(0);
    });
    describe("save method", function () {
        var delimiter,
            filename,
            store;
        beforeEach(function () {
            filename = random.path();
            delimiter = random.character();
            filestore.defaultDelimiter = delimiter;
            store = filestore(filename);
            filestore.defaultDelimiter = random.character();
            mockFs.appendFile.calls[0].callback(null);
            mockBuffer.byteLength.returnValue(4);

            // delete previous calls to make tests more intuitive
            mockFs.appendFile.calls.length = 0;
        });
        it("appends the JSON result and delimiter to the file", function () {
            var str = random.string();
            store.save(str);
            expect(mockFs.appendFile.calls[0].args)
                .to.have.property(0, filename)
                .and.to.have.property(1, str + delimiter);
        });
        it("doesn't call the callback immediately", function () {
            store.save(random.string(), cb.mock);
            expect(cb.calls).to.have.length(0);
        });
        it("calls the callback when append is complete", function () {
            store.save(random.string(), cb.mock);
            mockFs.appendFile.calls[0].callback();
            expect(cb.calls).to.have.length(1);
        });
        it("emits 'drain' when append is complete", function () {
            store.save(random.string());
            store.on("drain", cb.mock);
            mockFs.appendFile.calls[0].callback();
            expect(cb.calls).to.have.length(1);
        });
        it("emits an error if there is an append error", function () {
            var err = {};
            store.save(random.string());
            store.on("error", cb.mock);
            mockFs.appendFile.calls[0].callback(err);
            expect(cb.calls[0].args).to.have.property(0, err);
        });
        it("passes any error to the callback", function () {
            var err = {};
            store.save(random.string(), cb.mock);
            mockFs.appendFile.calls[0].callback(err);
            expect(cb.calls[0].args).to.have.property(0, err);
        });
        it("doesn't call append more than once", function () {
            store.save(random.string());
            store.save(random.string());
            expect(mockFs.appendFile.calls).to.have.length(1);
        });
        it("calls the second append after the first has returned", function () {
            store.save(random.string());
            store.save(random.string());
            mockFs.appendFile.calls[0].callback();
            expect(mockFs.appendFile.calls).to.have.length(2);
        });
        it("groups all appends after the second", function () {
            var i = 3,
                results = [];
            while (i--) {
                results.push(random.number);
            }
            i = 3;
            while (i--) {
                store.save({});
            }
            mockFs.appendFile.calls[0].callback();
            mockFs.appendFile.calls[1].callback();
            expect(mockFs.appendFile.calls).to.have.length(2);
        });
        it("only forms a queue up to the buffer size", function () {
            store.bufferSize = random.natural();
            mockBuffer.byteLength.returnValue(random.natural({
                max : store.bufferSize / 2
            }));
            store.save(random.string());
            mockBuffer.byteLength.returnValue(random.natural({
                max : store.bufferSize / 2
            }));
            store.save(random.string());
            mockBuffer.byteLength.returnValue(random.natural({
                min : store.bufferSize
            }));
            store.save(random.string());
            mockFs.appendFile.calls[0].callback();
            mockFs.appendFile.calls[1].callback();
            expect(mockFs.appendFile.calls).to.have.length(3);
        });
        it("won't call a callback before it's done", function () {
            store.bufferSize = 6;
            store.save(random.string());
            store.save(random.string());
            store.save(random.string(), cb.mock);
            mockFs.appendFile.calls[0].callback();
            expect(cb.calls).to.have.length(0);
        });
        it("calls the relevant callbacks for each append", function () {
            store.bufferSize = 10;
            store.save(random.string());
            store.save(random.string());
            store.save(random.string(), cb.mock);
            mockFs.appendFile.calls[0].callback();
            mockFs.appendFile.calls[1].callback();
            mockFs.appendFile.calls[2].callback();
            expect(cb.calls).to.have.length(1);
        });
        it("emits a single drain for multiple appends", function () {
            store.bufferSize = 6;
            store.on("drain", cb.mock);
            store.save(random.string());
            store.save(random.string());
            mockFs.appendFile.calls[0].callback();
            mockFs.appendFile.calls[1].callback();
            expect(cb.calls).to.have.length(1);
        });
        describe("with string longer than the buffer size", function () {
            beforeEach(function () {
                store.bufferSize = random.natural();
                store.on("error", cb.mock);
            });
            it("emits an 'error' if anatomic writes disallowed", function () {
                store.allowAnatomicWrites = false;
                // test that error is immediate, even if write is queued
                store.save({});

                mockBuffer.byteLength.returnValue(random.natural({
                    min : store.bufferSize
                }));
                store.save(random.string());
                expect(cb.calls).to.have.length(1);
            });
            it("does not save if error is emitted", function () {
                store.allowAnatomicWrites = false;
                mockBuffer.byteLength.returnValue(random.natural({
                    min : store.bufferSize
                }));
                store.save(random.string);
                expect(mockFs.appendFile.calls).to.have.length(0);
            });
            it("does not emit an error by default", function () {
                mockBuffer.byteLength.returnValue(random.natural({
                    min : store.bufferSize
                }));
                store.save(random.string);
                expect(cb.calls).to.have.length(0);
            });
        });
    });
});
