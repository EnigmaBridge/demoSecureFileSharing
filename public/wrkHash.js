/**
 * SHA1, SHA256 computing web worker.
 */
importScripts('sjcl.js', 'sjcl.sha1.js');
var cmd;
var sha1Engine = new sjcl.hash.sha1();
var sha256Engine = new sjcl.hash.sha256();
var sha1, sha256;

function update(data) {
    //console.log('SHA update');
    sha1Engine.update(data.data);
    sha256Engine.update(data.data);
}

function reset() {
    sha1Engine.reset();
    sha256Engine.reset();
}

function finalize(data) {
    sha1 = sha1Engine.finalize();
    sha256 = sha256Engine.finalize();
    postMessage({'res':0, 'sha1':sha1, 'sha256':sha256});
}

function getLast() {
    postMessage({'res':0, 'sha1':sha1, 'sha256':sha256});
}

onmessage = function (event) {
    cmd = event.data;
    if (cmd.update) {
        update(cmd);
    } else if (cmd.finalize){
        finalize(cmd);
    } else if (cmd.reset) {
        reset();
    } else if (cmd.get) {
        getLast();
    } else {
        console.log("Unknown command");
    }
};