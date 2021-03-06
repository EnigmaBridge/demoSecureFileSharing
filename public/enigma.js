"use strict";
/**
 * EnigmaBridge API helper functions.
 * @author Dusan Klinec (ph4r05)
 * @license GPL3.
 */

/**
 * Monkey-patching for prototype inheritance.
 *
 * @param parentClassOrObject
 * @param newPrototype
 * @returns {Function}
 */
Function.prototype.inheritsFrom = function( parentClassOrObject, newPrototype ){
    if ( parentClassOrObject.constructor == Function )
    {
        //Normal Inheritance
        this.prototype = new parentClassOrObject;
        this.prototype.constructor = this;
        this.prototype.parent = parentClassOrObject.prototype;

        // Better for calling super methods. Avoids looping.
        this.superclass = parentClassOrObject.prototype;
        this.prototype = $.extend(this.prototype, newPrototype);

        // If we have inheritance chain A->B->C, A = root, A defines method x()
        // B also defines x = function() { this.parent.x.call(this); }, C does not defines x,
        // then calling x on C will cause infinite loop because this references to C in B.x() and this.parent is B in B.x()
        // not A as desired.
    }
    else
    {
        //Pure Virtual Inheritance
        this.prototype = parentClassOrObject;
        this.prototype.constructor = this;
        this.prototype.parent = parentClassOrObject;
        this.superclass = parentClassOrObject;
    }
    return this;
};

/**
 * SHA1 implementation, not present in default SJCL.
 * We need it for HOTP.
 */
/** Javascript SHA-1 implementation.
 *
 * Based on the implementation in RFC 3174, method 1, and on the SJCL
 * SHA-256 implementation.
 *
 * @author Quinn Slack
 */
/**
 * Context for a SHA-1 operation in progress.
 * @constructor
 * @class Secure Hash Algorithm, 160 bits.
 */
sjcl.hash.sha1 = function (hash) {
    if (hash) {
        this._h = hash._h.slice(0);
        this._buffer = hash._buffer.slice(0);
        this._length = hash._length;
    } else {
        this.reset();
    }
};

/**
 * Hash a string or an array of words.
 * @static
 * @param {bitArray|String} data the data to hash.
 * @return {bitArray} The hash value, an array of 5 big-endian words.
 */
sjcl.hash.sha1.hash = function (data) {
    return (new sjcl.hash.sha1()).update(data).finalize();
};
sjcl.hash.sha1.prototype = {
    /**
     * The hash's block size, in bits.
     * @constant
     */
    blockSize: 512,

    /**
     * Reset the hash state.
     * @return this
     */
    reset:function () {
        this._h = this._init.slice(0);
        this._buffer = [];
        this._length = 0;
        return this;
    },

    /**
     * Input several words to the hash.
     * @param {bitArray|String} data the data to hash.
     * @return this
     */
    update: function (data) {
        if (typeof data === "string") {
            data = sjcl.codec.utf8String.toBits(data);
        }
        var i, b = this._buffer = sjcl.bitArray.concat(this._buffer, data),
            ol = this._length,
            nl = this._length = ol + sjcl.bitArray.bitLength(data);
        if (typeof Uint32Array !== 'undefined') {
            var c = new Uint32Array(b);
            var j = 0;
            for (i = this.blockSize+ol - ((this.blockSize+ol) & (this.blockSize-1)); i <= nl;
                 i+= this.blockSize) {
                this._block(c.subarray(16 * j, 16 * (j+1)));
                j += 1;
            }
            b.splice(0, 16 * j);
        } else {
            for (i = this.blockSize+ol - ((this.blockSize+ol) & (this.blockSize-1)); i <= nl;
                 i+= this.blockSize) {
                this._block(b.splice(0,16));
            }
        }
        return this;
    },

    /**
     * Complete hashing and output the hash value.
     * @return {bitArray} The hash value, an array of 5 big-endian words. TODO
     */
    finalize:function () {
        var i, b = this._buffer, h = this._h;

        // Round out and push the buffer
        b = sjcl.bitArray.concat(b, [sjcl.bitArray.partial(1,1)]);
        // Round out the buffer to a multiple of 16 words, less the 2 length words.
        for (i = b.length + 2; i & 15; i++) {
            b.push(0);
        }

        // append the length
        b.push(Math.floor(this._length / 0x100000000));
        b.push(this._length | 0);

        while (b.length) {
            this._block(b.splice(0,16));
        }

        this.reset();
        return h;
    },

    /**
     * The SHA-1 initialization vector.
     * @private
     */
    _init:[0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476, 0xC3D2E1F0],

    /**
     * The SHA-1 hash key.
     * @private
     */
    _key:[0x5A827999, 0x6ED9EBA1, 0x8F1BBCDC, 0xCA62C1D6],

    /**
     * The SHA-1 logical functions f(0), f(1), ..., f(79).
     * @private
     */
    _f:function(t, b, c, d) {
        if (t <= 19) {
            return (b & c) | (~b & d);
        } else if (t <= 39) {
            return b ^ c ^ d;
        } else if (t <= 59) {
            return (b & c) | (b & d) | (c & d);
        } else if (t <= 79) {
            return b ^ c ^ d;
        }
    },

    /**
     * Circular left-shift operator.
     * @private
     */
    _S:function(n, x) {
        return (x << n) | (x >>> 32-n);
    },

    /**
     * Perform one cycle of SHA-1.
     * @param {Uint32Array|bitArray} words one block of words.
     * @private
     */
    _block:function (words) {
        var t, tmp, a, b, c, d, e,
            h = this._h;
        var w;
        if (typeof Uint32Array !== 'undefined') {
            // When words is passed to _block, it has 16 elements. SHA1 _block
            // function extends words with new elements (at the end there are 80 elements).
            // The problem is that if we use Uint32Array instead of Array,
            // the length of Uint32Array cannot be changed. Thus, we replace words with a
            // normal Array here.
            w = Array(80); // do not use Uint32Array here as the instantiation is slower
            for (var j=0; j<16; j++){
                w[j] = words[j];
            }
        } else {
            w = words;
        }

        a = h[0]; b = h[1]; c = h[2]; d = h[3]; e = h[4];

        for (t=0; t<=79; t++) {
            if (t >= 16) {
                w[t] = this._S(1, w[t-3] ^ w[t-8] ^ w[t-14] ^ w[t-16]);
            }
            tmp = (this._S(5, a) + this._f(t, b, c, d) + e + w[t] +
                this._key[Math.floor(t/20)]) | 0;
            e = d;
            d = c;
            c = this._S(30, b);
            b = a;
            a = tmp;
        }

        h[0] = (h[0]+a) |0;
        h[1] = (h[1]+b) |0;
        h[2] = (h[2]+c) |0;
        h[3] = (h[3]+d) |0;
        h[4] = (h[4]+e) |0;
    }
};

/**
 * Bit array codec implementations.
 * @author Nils Kenneweg
 */
sjcl.codec.base32 = {
    /** The base32 alphabet.
     * @private
     */
    _chars: "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567",
    _hexChars: "0123456789ABCDEFGHIJKLMNOPQRSTUV",

    /* bits in an array */
    BITS: 32,
    /* base to encode at (2^x) */
    BASE: 5,
    /* bits - base */
    REMAINING: 27,

    /** Convert from a bitArray to a base32 string. */
    fromBits: function (arr, _noEquals, _hex) {
        var BITS = sjcl.codec.base32.BITS, BASE = sjcl.codec.base32.BASE, REMAINING = sjcl.codec.base32.REMAINING;
        var out = "", i, bits=0, c = sjcl.codec.base32._chars, ta=0, bl = sjcl.bitArray.bitLength(arr);

        if (_hex) {
            c = sjcl.codec.base32._hexChars;
        }

        for (i=0; out.length * BASE < bl; ) {
            out += c.charAt((ta ^ arr[i]>>>bits) >>> REMAINING);
            if (bits < BASE) {
                ta = arr[i] << (BASE-bits);
                bits += REMAINING;
                i++;
            } else {
                ta <<= BASE;
                bits -= BASE;
            }
        }
        while ((out.length & 7) && !_noEquals) { out += "="; }

        return out;
    },

    /** Convert from a base32 string to a bitArray */
    toBits: function(str, _hex) {
        str = str.replace(/\s|=/g,'').toUpperCase();
        var BITS = sjcl.codec.base32.BITS, BASE = sjcl.codec.base32.BASE, REMAINING = sjcl.codec.base32.REMAINING;
        var out = [], i, bits=0, c = sjcl.codec.base32._chars, ta=0, x, format="base32";

        if (_hex) {
            c = sjcl.codec.base32._hexChars;
            format = "base32hex"
        }

        for (i=0; i<str.length; i++) {
            x = c.indexOf(str.charAt(i));
            if (x < 0) {
                // Invalid character, try hex format
                if (!_hex) {
                    try {
                        return sjcl.codec.base32hex.toBits(str);
                    }
                    catch (e) {}
                }
                throw new sjcl.exception.invalid("this isn't " + format + "!");
            }
            if (bits > REMAINING) {
                bits -= REMAINING;
                out.push(ta ^ x>>>bits);
                ta  = x << (BITS-bits);
            } else {
                bits += BASE;
                ta ^= x << (BITS-bits);
            }
        }
        if (bits&56) {
            out.push(sjcl.bitArray.partial(bits&56, ta, 1));
        }
        return out;
    }
};
sjcl.codec.base32hex = {
    fromBits: function (arr, _noEquals) { return sjcl.codec.base32.fromBits(arr,_noEquals,1); },
    toBits: function (str) { return sjcl.codec.base32.toBits(str,1); }
};

/**
 * Base EB package.
 * @type {{name: string}}
 */
var eb = {
    name: "EB",
};

/** @namespace Exceptions. */
eb.exception = {
    /** @constructor Ciphertext is corrupt. */
    corrupt: function (message) {
        this.toString = function () {
            return "CORRUPT: " + this.message;
        };
        this.message = message;
    },
    /** @constructor Invalid input. */
    invalid: function (message) {
        this.toString = function () {
            return "INVALID: " + this.message;
        };
        this.message = message;
    },
}

/**
 * EB misc wrapper.
 * @type {{name: string, genNonce: eb.misc.genNonce, genHexNonce: eb.misc.genHexNonce, genAlphaNonce: eb.misc.genAlphaNonce, xor: eb.misc.xor}}
 */
eb.misc = {
    name: "misc",

    MAX_SAFE_INTEGER: Math.pow(2, 53) - 1,
    MIN_SAFE_INTEGER: -(Math.pow(2, 53) - 1),
    EPSILON: 2.2204460492503130808472633361816E-16,

    genNonce: function(length, alphabet){
        var nonce = "";
        var alphabetLen = alphabet.length;
        var i = 0;

        for(i = 0; i < length; i++){
            nonce += alphabet.charAt(((sjcl.random.randomWords(1)[0]) & 0xffff) % alphabetLen);
        }

        return nonce;
    },
    genHexNonce: function(length){
        return this.genNonce(length, "0123456789abcdef");
    },
    genAlphaNonce: function (length){
        return this.genNonce(length, "0123456789abcdefghijklmnopqrstuvwxyz");
    },
    xor: function(x,y){
        return [x[0]^y[0],x[1]^y[1],x[2]^y[2],x[3]^y[3]];
    },
    xor8: function(x,y){
        return [x[0]^y[0],x[1]^y[1],x[2]^y[2],x[3]^y[3],x[4]^y[4],x[5]^y[5],x[6]^y[6],x[7]^y[7]];
    },
    absorb: function(dst, src){
        if (src === undefined){
            return dst;
        }

        for(var key in src) {
            if (src.hasOwnProperty(key)) {
                dst[key] = src[key];
            }
        }
        return dst;
    },
    absorbKey: function(dst, src, key){
        if (src !== undefined && key in src){
            dst[key] = src[key];
        }
        return dst;
    },
    absorbKeyEx: function(dst, src, srcKey, dstKey){
        if (src !== undefined && srcKey in src){
            dst[dstKey] = src[srcKey];
        }
        return dst;
    },
    absorbValue: function(dst, value, valueKey, defaultValue){
        if (value !== undefined){
            dst[valueKey] = value;
        } else if (defaultValue !== undefined){
            dst[valueKey] = defaultValue;
        }
    },

    /**
     * Converts argument to the SJCL bitArray.
     * @param x
     *      if x is a number, it is converted to SJCL bitArray. Warning, 32bit numbers are supported only.
     *      if x is a string, it is considered as hex coded string.
     *      if x is an array it is considered as SJCL bitArray.
     * @returns {*}
     */
    inputToBits: function(x){
        var ln;
        if (typeof(x) === 'number'){
            return sjcl.codec.hex.toBits(sprintf("%02x", x));

        } else if (typeof(x) === 'string') {
            x = x.trim().replace(/^0x/, '');
            if (!(x.match(/^[0-9A-Fa-f]+$/))){
                throw new eb.exception.invalid("Invalid hex coded number");
            }

            return sjcl.codec.hex.toBits(x);

        } else {
            return x;

        }
    },

    /**
     * Converts argument to the hexcoded string.
     * @param x -
     *      if x is a number, will be converted to a hex string. Warning, 32bit numbers are supported only.
     *      if x is a string, it is considered as hex coded string.
     *      if x is an array it is considered as SJCL bitArray.
     */
    inputToHex: function(x){
        var tmp,ln;
        if (typeof(x) === 'number'){
            return sprintf("%x", x);

        } else if (typeof(x) === 'string') {
            x = x.trim().replace(/^0x/, '');
            if (!(x.match(/^[0-9A-Fa-f]+$/))){
                throw new eb.exception.invalid("Invalid hex coded number");
            }

            return x;

        } else {
            return sjcl.codec.hex.fromBits(x);

        }
    },

    /**
     * Converts argument to the integer. If string is passed, it is considered as hex-coded integer.
     * @param x
     * @param noThrow
     */
    inputToHexNum: function(x, noThrow){
        var tmp,ln;
        if (typeof(x) === 'number'){
            return x;

        } else if (typeof(x) === 'string') {
            x = x.trim().replace(/^0x/, '');
            if (!(x.match(/^[0-9A-Fa-f]+$/))){
                throw new eb.exception.invalid("Invalid hex coded number");
            }

            return parseInt(x, 16);

        } else if (noThrow === undefined || !noThrow) {
            throw new eb.exception.invalid("Invalid argument - not a number or string");

        } else {
            return x;

        }
    },

    /**
     * Function generates a zero bit vector of given size.
     * @param bitLength
     */
    getZeroBits: function(bitLength){
        if (bitLength <= 0) {
            return [];
        }

        var bs = [0, 0, 0, 0,   0, 0, 0, 0], i;
        for(i=256; i<bitLength; i+=32){
            bs.push(0);
        }

        return sjcl.bitArray.bitSlice(bs, 0, bitLength);
    },

    /**
     * Function generates random bit vector of given length.
     * @param bitLength
     */
    getRandomBits: function(bitLength){
        return sjcl.bitArray.clamp(sjcl.random.randomWords(Math.ceil(bitLength/32)), bitLength);
    },

    /**
     * Converts given number to the bitArray representation.
     *
     * @param num
     * @param bitSize
     */
    numberToBits: function(num, bitSize){
        if (bitSize > 32){
            throw new eb.exception.invalid("num can be maximally 32bit wide");
        }
        if (bitSize == 32){
            return [num];
        }
        return sjcl.bitArray.bitSlice([num], 32-bitSize, 32);
    },

    /**
     * Serializes 64bit number to a bitArray.
     * @param {Number} num
     * @returns {bitArray|Array}
     */
    serialize64bit: function(num){
        return [Math.floor(num/0x100000000), (num|0)];
    },

    /**
     * Deserializes 64bit number from bitArray
     * @param {bitArray} arr
     * @param {number} [offset=0] Bit offset.
     */
    deserialize64bit: function(arr, offset){
        offset = offset || 0;
        var w = sjcl.bitArray;
        var hi = w.extract32(arr, offset);
        var lo = w.extract32(arr, offset+32);
        return (hi*0x100000000 + (lo) + (lo < 0 ? 0x100000000 : 0));
    },

    /**
     * Left zero padding to the even number of hexcoded digits.
     * @param x
     * @returns {*}
     */
    padHexToEven: function(x){
        x = x.trim().replace(/[\s]+/g, '').replace(/^0x/, '');
        return ((x.length & 1) == 1) ? ('0'+x) : x;
    },

    /**
     * Left zero padding for hex string to the given size.
     * @param x
     * @param size
     * @returns {*}
     */
    padHexToSize: function(x, size){
        x = x.trim().replace(/[\s]+/g, '').replace(/^0x/, '');
        return (x.length<size) ? (('0'.repeat(size-x.length))+x) : x
    },

    /**
     * Pads number x to full block size.
     * Useful when computing total size after padding added.
     * If x is multiple of bs, another block is added (pkcs7 works in this way).
     *
     * @param x number of units
     * @param bs block size - same units as x
     */
    padToBlockSize: function(x, bs){
        return x + (bs - (x % bs));
    },

    /**
     * Returns the byte length of an utf8 string.
     * @param str
     * @returns {*}
     */
    strByteLength: function(str) {
        var s = str.length;
        for (var i=str.length-1; i>=0; i--) {
            var code = str.charCodeAt(i);
            if (code > 0x7f && code <= 0x7ff) s++;
            else if (code > 0x7ff && code <= 0xffff) s+=2;
            if (code >= 0xDC00 && code <= 0xDFFF) i--; //trail surrogate
        }
        return s;
    },

    /**
     * Generates checksum value from the input.
     * @param x hexcoded string or bitArray. If you want to checksum arbitrary string, hash it first.
     * @param size
     */
    genChecksumValue: function(x, size){
        var inputBits = eb.misc.inputToBits(x);

        // As we are reducing information from x to base32*size bits, we are performing
        // two hash rounds to make sure the dependency is non-trivial.
        var toHash = sjcl.codec.hex.fromBits(inputBits) + ',' + size + ',' + sjcl.bitArray.bitLength(inputBits);
        var inputHashBits = sjcl.hash.sha256.hash(toHash);
        var inputHashBits2 = sjcl.hash.sha256.hash(sjcl.codec.hex.fromBits(inputHashBits) + toHash);
        var hashOut = [], i;
        for(i=0; i<256/32; i++){
            hashOut[i] = inputHashBits[i] ^ inputHashBits2[i];
        }

        // Base 32, size first characters
        var base32string = sjcl.codec.base32.fromBits(hashOut);
        return base32string.substring(0, size);
    },

    /**
     * Generates checksum value from the input.
     * @param x an arbitraty string
     * @param size
     */
    genChecksumValueFromString: function(x, size){
        return eb.misc.genChecksumValue(sjcl.hash.sha256.hash(x), size);
    },

    /**
     * Asserts the condition.
     * @param condition
     * @param message
     */
    assert: function(condition, message) {
        if (!condition) {
            message = message || "Assertion failed";
            if (typeof Error !== "undefined") {
                throw new Error(message);
            }
            throw message; // Fallback
        }
    }
};

eb.codec = {};

/**
 * Fault tolerant utf8 codec for user entries.
 * When converting from hexcoded string to raw data, data may contain both UTF8 characters and hex-coded characters.
 * Parsing result finds utf8 characters in the hexbytes. If byte sequence does not form valid utf8 character, it is
 * parsed as ordinary hex sequence.
 *
 * When converting from raw data to hexdata, utf8 characters are allowed. Moreover it supports individual byte coding
 * \x[A-Fa-f0-9]{2} and backslash escaping \\. Single individual backslash is ignored.
 * @type {{}}
 */
eb.codec.utf8 = {
    toHex: function(x, options) {
        var i, ln = x.length;
        var out = "";

        for (i = 0; i < ln; i++) {
            var cChar = x.charAt(i);
            var remChars = (ln - i - 1);

            if (cChar === '\\') {
                // Byte coding \xFF ?
                if (remChars >= 3) {
                    var hCode = x.substring(i, i + 4);
                    var hRegex = /\\x([a-fA-F0-9]{2})/g;
                    var match = hRegex.exec(hCode);
                    if (match) {
                        out += match[1];
                        i += 3;
                        continue;
                    }
                }

                // Escaping \\ ?
                if (remChars >= 1) {
                    var nChar = x.substring(i + 1, i + 2);
                    if (nChar === '\\') {
                        out += Number('\\'.charCodeAt(0)).toString(16);
                        i += 1;
                        continue;
                    }
                }

                // Invalid escaping, ignore this backslash.
                continue;
            }

            // Get UTF8 hex representation.
            var cc = unescape(encodeURIComponent(cChar));
            var jj, llen;
            for (jj = 0, llen = cc.length; jj < llen; jj++) {
                var chNum = (Number(cc.charCodeAt(jj))).toString(16);
                if ((chNum.length & 1) == 1) {
                    chNum = "0" + chNum;
                }
                out += chNum;
            }
        }

        return out;
    },

    /**
     * Converts hexcoded string to raw data.
     * @param x
     * @param options
     * @returns {string}
     */
    fromHex: function(x, options) {
        var parsed = eb.codec.utf8.fromHexParse(x, options);
        var str="";
        var cur, i, len;
        for(i=0, len=parsed.parsed.length; i<len; i++){
            cur=parsed.parsed[i];
            str += cur.utf8 ? cur.rep : cur.enc;
        }

        return str;
    },

    /**
     * Parses hex coded string, can accept utf8 characters.
     * @param x
     * @param options,
     *      - if acceptUtf8==false, UTF8 characters are not recognized, each character has 1 byte encoding. Default = true,
     *        thus UTF8 characters are recognized and parsed.
     *      - if acceptOnlyUtf8==true, non-UTF8 characters are skipped, otherwise they are parsed as hexcoded.
     *
     * @returns {{nonUtf8Chars: number, parsed: Array}}
     */
    fromHexParse: function(x, options) {
        var defaults = {
            'acceptUtf8': true,
            'acceptOnlyUtf8': false
        };

        options = $.extend(defaults, options || {});
        var acceptUtf8 = options && options.acceptUtf8;
        var acceptOnlyUtf8 = options && options.acceptOnlyUtf8;

        // Process only even lengths.
        var ln = x.length;
        if ((ln & 1) == 1) {
            ln-=1;
        }

        var nonUtf8Chars = 0;
        var i, cByte, cBits, cStr, cNum;
        var out = [];

        // UTF8 encoding table
        //7 	U+0000	    U+007F	    1	0xxxxxxx
        //11	U+0080	    U+07FF	    2	110xxxxx	10xxxxxx
        //16	U+0800	    U+FFFF	    3	1110xxxx	10xxxxxx	10xxxxxx
        //21	U+10000	    U+1FFFFF	4	11110xxx	10xxxxxx	10xxxxxx	10xxxxxx
        //26	U+200000	U+3FFFFFF	5	111110xx	10xxxxxx	10xxxxxx	10xxxxxx	10xxxxxx
        //31	U+4000000	U+7FFFFFFF	6	1111110x	10xxxxxx	10xxxxxx	10xxxxxx	10xxxxxx	10xxxxxx
        for(i=0; i<ln; i+=2){
            cByte = (x[i] + x[i+1]).toUpperCase();
            cBits = h.toBits(cByte);
            cNum = sjcl.bitArray.extract(cBits,0,8);

            // 1byte char representation. ASCII.
            if (!acceptUtf8 || (cNum & 0x80) == 0){
                var tmpChar = String.fromCharCode(cNum);
                if (tmpChar === "\\"){
                    tmpChar = "\\\\";
                }

                out.push({
                    'b':1,
                    'utf8':true,
                    'hex':cByte,
                    'enc':String.fromCharCode(cNum),
                    'rep':cNum < 32 || cNum >= 127 ? "\\x" + cByte : tmpChar});
                continue;
            }

            // Look for utf8 character.
            var remBytes = (ln-i-2)/2;
            var valid = false;
            var j = 0;
            for(j=2; j<=6; j++){
                // Create first UTF8 byte mask signature, j = number of bytes character occupies.
                var signature = (Math.pow(2, j)-1)<<1;
                var byteLow = cNum >> (8-j-1);
                if (signature !== byteLow){
                    continue;
                }

                // Signature matched, check if there is enough number of bytes in the buffer
                if (remBytes < (j-1)){
                    break;
                }

                // Start building \uxxxx representation.
                var utfOut = h.toBits(sprintf("0000%x", cNum & ((1<<(8-j-1))-1) ) );
                var utfOutLen = sjcl.bitArray.bitLength(utfOut);
                if (utfOutLen > (8-j-1)){
                    utfOut = sjcl.bitArray.bitSlice(utfOut, utfOutLen-(8-j-1));
                }

                // Check if each next byte has 10xxxxxx format.
                var k = 0;
                var byteValid = true;
                for(k=0; k<j-1; k++){
                    var nByte = eb.codec.utf8.getByte(x, i+2+2*k);
                    if ((nByte >>> 6) != 2){
                        byteValid = false;
                        break;
                    }

                    var cBitArray = h.toBits(sprintf("0000%x", nByte & ((1<<6)-1) ) );
                    var cBitLen = sjcl.bitArray.bitLength(cBitArray);
                    if (cBitLen >= 7){
                        cBitArray = sjcl.bitArray.bitSlice(cBitArray, cBitLen-6);
                    }

                    utfOut = sjcl.bitArray.concat(utfOut, cBitArray);
                }

                // Successing were not in the 10xxxxxx format.
                if(!byteValid){
                    break;
                }

                // utfOut needs to be left padded with zeros to be correctly interpreted.
                utfOutLen = sjcl.bitArray.bitLength(utfOut);
                if ((utfOutLen & 7) != 0){
                    var toPadLen = 8-(utfOutLen & 7);
                    utfOut = sjcl.bitArray.concat(sjcl.bitArray.bitSlice(h.toBits("00"),0,toPadLen), utfOut);
                }

                valid=true;
                out.push({
                    'b':j,
                    'utf8':true,
                    'hex':cByte + x.substring(i+2, i+2+(j-1)*2),
                    'enc':"\\u" + h.fromBits(utfOut),
                    'rep':String.fromCharCode(parseInt(h.fromBits(utfOut), 16))
                });

                i+=2*(j-1);
                break;
            }

            if (valid || acceptOnlyUtf8){
                continue;
            }

            out.push({
                'b':1,
                'utf8':false,
                'hex':cByte,
                'enc':"\\x" + cByte,
                'rep':"\\x" + cByte});

            nonUtf8Chars+=1;
        }

        return {'nonUtf8Chars':nonUtf8Chars, 'parsed':out};
    },

    getByte: function (str, offset){
        var cByte = str[offset] + str[offset+1];
        var cBits = h.toBits(cByte);
        return sjcl.bitArray.extract(cBits,0,8);
    }
};

/**
 * EB padding schemes wrapper.
 * @type {{name: string}}
 */
eb.padding = {
    name: "padding"
};

/**
 * Padding - identity function.
 * @type {{name: string, pad: eb.padding.empty.pad, unpad: eb.padding.empty.unpad}}
 */
eb.padding.empty = {
    name: "empty",
    pad: function(a, blocklen){
        return a;
    },
    unpad: function(a, blocklen){
        return a;
    }
};

/**
 * PKCS7 padding.
 * @type {{name: string, pad: eb.padding.pkcs7.pad, unpad: eb.padding.pkcs7.unpad}}
 */
eb.padding.pkcs7 = {
    name: "pkcs7",
    pad: function(a, blocklen){
        blocklen = blocklen || 16;
        if (!blocklen || (blocklen & (blocklen - 1))){
            throw new sjcl.exception.corrupt("blocklength has to be power of 2");
        }
        if (blocklen != 16){
            throw new sjcl.exception.corrupt("blocklength different than 16 is not implemented yet");
            // TODO: implement multiple block sizes.
        }

        var bl = sjcl.bitArray.bitLength(a);
        var padLen = (16 - ((bl >> 3) & 15));
        var padFill = padLen * 0x1010101;
        return sjcl.bitArray.concat(a, [padFill, padFill, padFill, padFill]).slice(0, ((bl >> 3) + padLen) >> 2);
    },
    unpad: function(a, blocklen){
        blocklen = blocklen || 16;
        if (!blocklen || (blocklen & (blocklen - 1))){
            throw new sjcl.exception.corrupt("blocklength has to be power of 2");
        }
        if (blocklen != 16){
            throw new sjcl.exception.corrupt("blocklength different than 16 is not implemented yet");
            // TODO: implement multiple block sizes.
        }

        var w = sjcl.bitArray;
        var bl = w.bitLength(a);
        if (bl & 127 || !a.length) {
            throw new sjcl.exception.corrupt("input must be a positive multiple of the block size");
        }

        var bi = a[((bl>>3)>>2) - 1] & 255;
        if (bi == 0 || bi > 16) {
            throw new sjcl.exception.corrupt("pkcs#5 padding corrupt");
        }

        var bo = bi * 0x1010101;
        if (!w.equal(w.bitSlice([bo, bo, bo, bo], 0, bi << 3), w.bitSlice(a, (a.length << 5) - (bi << 3), a.length << 5))) {
            throw new sjcl.exception.corrupt("pkcs#5 padding corrupt");
        }

        return w.bitSlice(a, 0, (a.length << 5) - (bi << 3));
    }
};

/**
 *  PKCS 1.5 padding for RSA operation.
 *
 *  EB = 00 || BT || PS || 00 || D
 *      .. EB = encryption block
 *      .. 00 prefix so EB is not bigger than modulus.
 *      .. BT = 1B block type {00, 01} for private key operation, {02} for public key operation.
 *      .. PS = padding string. Has length k - 3 - len(D).
 *      if BT == 0, then padding consists of 0x0, but we need to know size of data in order to remove padding unambiguously.
 *      if BT == 1, then padding consists of 0xFF.
 *      if BT == 2, then padding consists of randomly generated bytes, does not contain 0x00 byte.
 *      .. D  = data
 *      [https://tools.ietf.org/html/rfc2313 PKCS#1 1.5]
 *
 * @type {{name: string, unpad: eb.padding.pkcs15.unpad, const: *, char: *}}
 */
eb.padding.pkcs15 = {
    name: "pkcs1.5",
    pad: function(a, blockLength, bt){
        var w = sjcl.bitArray;
        var h = sjcl.codec.hex;
        var bl = w.bitLength(a);
        var blb = bl / 8;
        if (bt === undefined){
            bt = 0;
        }
        if (bl & 7 || !a.length) {
            throw new sjcl.exception.corrupt("input type has to have be byte padded, bl="+bl);
        }

        if (bt != 0 && bt != 1 && bt != 2){
            throw new sjcl.exception.corrupt("invalid BT size");
        }

        if (blb+3 > blockLength){
            throw new sjcl.exception.corrupt("data to pad is too big for the padding block length");
        }

        var psLen = blockLength - 3 - blb;
        var ps = [], i, tmp=0;
        for (i=0; i<psLen; i++) {
            var curByte = 0;
            if (bt == 1){
                curByte = 0xff;
            } else if (bt == 2){
                do {
                    curByte = (sjcl.random.randomWords(1)[0]) & 0xff;
                }while(curByte == 0);
            }

            tmp = tmp << 8 | curByte;
            if ((i&3) === 3) {
                ps.push(tmp);
                tmp = 0;
            }
        }
        if (i&3) {
            ps.push(sjcl.bitArray.partial(8*(i&3), tmp));
        }

        var baBuff = h.toBits("00");
        baBuff = w.concat(baBuff, h.toBits(sprintf("%02x", bt)));
        baBuff = w.concat(baBuff, ps);
        baBuff = w.concat(baBuff, h.toBits("00"));
        return w.concat(baBuff, a);
    },
    unpad: function(a){
        var w = sjcl.bitArray;
        var bl = w.bitLength(a);
        var blb = bl / 8;
        if (bl & 7 || blb < 3 || !a.length) {
            throw new sjcl.exception.corrupt("data size block is invalid");
        }

        // Check the first byte.
        var bOffset = 0;
        var prefixByte = w.extract(a, bOffset, 8);
        if (prefixByte != 0x0){
            throw new sjcl.exception.corrupt("data size block is invalid");
        }

        bOffset += 8;
        var bt = w.extract(a, bOffset, 8);

        // BT can be only from set {0,1,2}.
        if (bt != 0 && bt != 1 && bt != 2){
            throw new sjcl.exception.corrupt("Padding data error, BT is outside of the definition set");
        }

        // Find D in the padded data. Strategy depends on the BT.
        var dataPosStart = -1, i= 0, cur=0;
        if (bt == 0){
            // Scan for first non-null character.
            for(i = 2; i < blb; i++){
                cur = w.extract(a, 8*i, 8);
                if (cur != 0){
                    dataPosStart = i;
                    break;
                }
            }

        } else if (bt == 1){
            // Find 0x0, report failure in 0xff
            var ffCorrect = true;
            for(i = 2; i < blb; i++){
                cur = w.extract(a, 8*i, 8);
                if (cur != 0 && cur != 0xff) {
                    ffCorrect = false;
                }

                if (cur == 0){
                    dataPosStart = i+1;
                    break;
                }
            }

            if (!ffCorrect){
                throw new sjcl.exception.corrupt("Trail of 0xFF in padding contains also unexpected characters");
            }

        } else {
            // bt == 2, find 0x0.
            for(i = 2; i < blb; i++){
                cur = w.extract(a, 8*i, 8);
                if (cur == 0){
                    dataPosStart = i+1;
                    break;
                }
            }
        }

        // If data position is out of scope, return nothing.
        if (dataPosStart < 0 || dataPosStart > blb){
            throw new sjcl.exception.corrupt("Padding could not be parsed, dataStart=" + dataPosStart + ", len="+blb);
        }

        // Check size of the output buffer.
        var dataLen = blb - dataPosStart;
        return w.bitSlice(a, dataPosStart*8);
    }
};

/**
 * Extracts 32bit number from the bitArray.
 * Original extract does not work with blength = 32 as 1<<32 == 1, it returns 0 always.
 *
 * @param a
 * @param bstart
 * @returns {*}
 */
sjcl.bitArray.extract32 = function(a, bstart){
    var x, sh = Math.floor((-bstart-32) & 31);
    if ((bstart + 32 - 1 ^ bstart) & -32) {
        x = (a[bstart/32|0] << (32 - sh)) ^ (a[bstart/32+1|0] >>> sh);
    } else {
        x = a[bstart/32|0] >>> sh;
    }
    return x;
};

/**
 * CBC-MAC with given cipher & padding.
 * @param Cipher
 * @param bs
 * @param padding
 */
sjcl.misc.hmac_cbc = function (Cipher, bs, padding) {
    this._cipher = Cipher;
    this._bs = bs = bs || 16;
    this._padding = padding = padding || eb.padding.empty;
};

/**
 * HMAC with the specified hash function.  Also called encrypt since it's a prf.
 * @param {bitArray|String} data The data to mac.
 */
sjcl.misc.hmac_cbc.prototype.encrypt = sjcl.misc.hmac_cbc.prototype.mac = function (data) {
    var i, w = sjcl.bitArray, bl = w.bitLength(data), bp = 0, output = [], xor = eb.misc.xor;
    var bsb = this._bs << 3;

    data = this._padding.pad(data, this._bs);
    var c = sjcl.codec.hex.toBits('00'.repeat(this._bs));
    for (i = 0; bp + bsb <= bl; i += 4, bp += bsb) {
        c = this._cipher.encrypt(xor(c, data.slice(i, i + 4)));
    }
    return c;
};

/**
 * CBC encryption mode implementation.
 * @type {{name: string, encrypt: sjcl.mode.cbc.encrypt, decrypt: sjcl.mode.cbc.decrypt}}
 */
sjcl.mode.cbc = {
    name: "cbc",
    encrypt: function (a, b, c, d, noPad) {
        if (d && d.length) {
            throw new sjcl.exception.invalid("cbc can't authenticate data");
        }
        if (sjcl.bitArray.bitLength(c) !== 128) {
            throw new sjcl.exception.invalid("cbc iv must be 128 bits");
        }

        var i, w = sjcl.bitArray, bl = w.bitLength(b), bp = 0, output = [], xor = eb.misc.xor;
        if (noPad && (bl & 127) != 0){
            throw new sjcl.exception.invalid("when padding is disabled, plaintext has to be a positive multiple of a block size");
        }
        if ((bl & 7) != 0) {
            throw new sjcl.exception.invalid("pkcs#5 padding only works for multiples of a byte");
        }

        for (i = 0; bp + 128 <= bl; i += 4, bp += 128) {
            c = a.encrypt(xor(c, b.slice(i, i + 4)));
            output.splice(i, 0, c[0], c[1], c[2], c[3]);
        }

        if (!noPad){
            bl = (16 - ((bl >> 3) & 15)) * 0x1010101;
            c = a.encrypt(xor(c, w.concat(b, [bl, bl, bl, bl]).slice(i, i + 4)));
            output.splice(i, 0, c[0], c[1], c[2], c[3]);
        }

        return output;
    },
    decrypt: function (a, b, c, d, noPad) {
        if (d && d.length) {
            throw new sjcl.exception.invalid("cbc can't authenticate data");
        }
        if (sjcl.bitArray.bitLength(c) !== 128) {
            throw new sjcl.exception.invalid("cbc iv must be 128 bits");
        }
        if ((sjcl.bitArray.bitLength(b) & 127) || !b.length) {
            throw new sjcl.exception.corrupt("cbc ciphertext must be a positive multiple of the block size");
        }
        var i, w = sjcl.bitArray, bi, bo, output = [], xor = eb.misc.xor;
        d = d || [];
        for (i = 0; i < b.length; i += 4) {
            bi = b.slice(i, i + 4);
            bo = xor(c, a.decrypt(bi));
            output.splice(i, 0, bo[0], bo[1], bo[2], bo[3]);
            c = bi;
        }
        if (!noPad) {
            bi = output[i - 1] & 255;
            if (bi == 0 || bi > 16) {
                throw new sjcl.exception.corrupt("pkcs#5 padding corrupt"); //TODO: padding oracle?
            }
            bo = bi * 0x1010101;
            if (!w.equal(w.bitSlice([bo, bo, bo, bo], 0, bi << 3), w.bitSlice(output, (output.length << 5) - (bi << 3), output.length << 5))) {
                throw new sjcl.exception.corrupt("pkcs#5 padding corrupt"); //TODO: padding oracle?
            }
            return w.bitSlice(output, 0, (output.length << 5) - (bi << 3));
        } else {
            return output;
        }
    }
};

/**
 * Request builder.
 * @type {{}}
 */
eb.comm = {
    name: "comm",

    REQ_METHOD_GET: "GET",
    REQ_METHOD_POST: "POST",

    /**
     * General status constants.
     */
    status: {
        ERROR_CLASS_SECURITY:           0x2000,

        ERROR_CLASS_WRONGDATA:          0x8000,
        SW_INVALID_TLV_FORMAT:          0x8000 | 0x04c,
        SW_WRONG_PADDING:               0x8000 | 0x03d,
        SW_STAT_INVALID_APIKEY:         0x8000 | 0x068,
        SW_AUTHMETHOD_NOT_ALLOWED:      0x8000 | 0x0b9,

        ERROR_CLASS_SECURITY_USER:      0xa000,
        SW_HOTP_KEY_WRONG_LENGTH:       0xa000 | 0x056,
        SW_HOTP_TOO_MANY_FAILED_TRIES:  0xa000 | 0x066,
        SW_HOTP_WRONG_CODE:             0xa000 | 0x0b0,
        SW_HOTP_COUNTER_OVERFLOW:       0xa000 | 0x0b3,
        SW_AUTHMETHOD_UNKNOWN:          0xa000 | 0x0ba,
        SW_AUTH_TOO_MANY_FAILED_TRIES:  0xa000 | 0x0b1,
        SW_AUTH_MISMATCH_USER_ID:       0xa000 | 0x0b6,
        SW_PASSWD_TOO_MANY_FAILED_TRIES:0xa000 | 0x063,
        SW_PASSWD_INVALID_LENGTH:       0xa000 | 0x064,
        SW_WRONG_PASSWD:                0xa000 | 0x065,

        SW_STAT_OK:                     0x9000,
        ERROR_CLASS_ERR_CHECK_ERRORS_6f:0x6f00,

        PDATA_FAIL_CONNECTION:          0x1,
        PDATA_FAIL_RESPONSE_PARSING:    0x3,
        PDATA_FAIL_RESPONSE_FAILED:     0x2,
    },

    /**
     * Converts mangled nonce value to the original one in ProcessData response.
     * ProcessData response has nonce return value response_nonce[i] = request_nonce[i] + 0x1
     * @param nonce
     * @returns {*}
     */
    demangleNonce: function(nonce){
        var ba = sjcl.bitArray;
        var bl = ba.bitLength(nonce);
        if ((bl&7) != 0){
            throw new sjcl.exception.invalid("nonce has to be aligned to bytes");
        }

        var i, w = sjcl.bitArray, bp = 0, output = [], c;
        for (i = 0; bp + 32 <= bl; i += 1, bp += 32) {
            c = nonce.slice(i, i + 1)[0] - 0x01010101;
            output.splice(i, 0, c);
        }

        if (bp+32 == bl){
            return output;
        }

        var rbl = bl - (bp-32);
        var sub = 0x01010101 & (((1<<rbl)-1)<<(32-rbl));
        c = (nonce.slice(i, i + 1)[0] - sub) >>> rbl;
        output.splice(i, 0, c);
        return sjcl.bitArray.clamp(output, bl);
    },

    /**
     * Base class constructor.
     */
    base: function(){

    },

    /**
     * User object constructor
     */
    uo: function(uoid, encKey, macKey){
        var av = eb.misc.absorbValue;
        av(this, uoid, 'uoid');
        av(this, encKey, 'encKey');
        av(this, macKey, 'macKey');
    }
};
eb.comm.base.prototype = {
    /**
     * If set to true, request body building steps are logged.
     * @input
     */
    debuggingLog: false,

    /**
     * Aux logging function
     * @input
     */
    logger: null,

    _log:  function(x) {
        if (!this.debuggingLog){
            return;
        }

        if (console && console.log){
            console.log(x);
        }

        if (this.logger){
            this.logger(x);
        }
    }
};
eb.comm.uo.prototype = {
    /**
     * User object ID.
     */
    uoid: undefined,

    /**
     * Encryption communication key.
     */
    encKey: undefined,

    /**
     * MAC communication key.
     */
    macKey: undefined,
};

/**
 * Raw EB request builder.
 *
 * Data format before encryption:
 * buff = 0x1f | <UOID-4B> | <freshness-nonce-8B> | userdata
 *
 * Encryption
 * AES-256/CBC/PKCS7, IV = 0x00000000000000000000000000000000
 *
 * MAC
 * AES-256-CBC-MAC.
 *
 * encBlock = enc(buff)
 * result = encBlock || mac(encBlock)
 *
 * output = Packet0| _PLAINAES_ | <plain-data-length-4B> | <plaindata> | hexcode(result)
 *
 * @param nonce
 * @param aesKey
 * @param macKey
 * @param userObjectId
 * @param reqType
 */
eb.comm.processDataRequestBodyBuilder = function(nonce, aesKey, macKey, userObjectId, reqType){
    this.userObjectId = userObjectId || -1;
    this.nonce = nonce || "";
    this.aesKey = aesKey || "";
    this.macKey = macKey || "";
    this.reqType = reqType || "PLAINAES";
};
eb.comm.processDataRequestBodyBuilder.prototype = {
    /**
     * User object ID, integer type.
     * @input
     */
    userObjectId : -1,

    /**
     * AES communication encryption key, hexcoded string.
     * @input
     */
    aesKey: "",

    /**
     * AES MAC communication key, hexcoded string.
     * @input
     */
    macKey: "",

    /**
     * Freshness nonce / IV, hexcoded string.
     * @input
     */
    nonce: "",

    /**
     * Request type. PLAINAES by default.
     * @input
     */
    reqType: "",

    /**
     * If set to true, request body building steps are logged.
     * @input
     */
    debuggingLog: false,

    /**
     * Aux logging function
     * @input
     */
    logger: null,

    genNonce: function(){
        this.nonce = eb.misc.genHexNonce(16);
        return this.nonce;
    },

    /**
     * Builds EB request.
     *
     * @param plainData - bitArray of the plaintext data.
     * @param requestData - bitArray with userdata to perform operation on (will be encrypted, MAC protected)
     * @returns request body string.
     */
    build: function(plainData, requestData){
        this.nonce = this.nonce || eb.misc.genHexNonce(16);
        var h = sjcl.codec.hex;
        var ba = sjcl.bitArray;
        var pad = eb.padding.pkcs7;

        // Plain data is empty for now.
        var baPlain = plainData;
        var plainDataLength = ba.bitLength(baPlain)/8;

        // Input data flag
        var baBuff = h.toBits("1f");
        // User Object ID
        baBuff = ba.concat(baBuff, h.toBits(sprintf("%08x", eb.misc.inputToHexNum(this.userObjectId))));
        // Freshness nonce
        baBuff = ba.concat(baBuff, h.toBits(this.nonce));
        // User data
        baBuff = ba.concat(baBuff, requestData);
        // Add padding.
        baBuff = pad.pad(baBuff);
        this._log('ProcessData function input PDIN (0x1f | <UOID-4B> | <nonce-8B> | data | pkcs#7padding) : ' + h.fromBits(baBuff) + "; len: " + ba.bitLength(baBuff));

        var aesKeyBits = eb.misc.inputToBits(this.aesKey);
        var macKeyBits = eb.misc.inputToBits(this.macKey);

        var aes = new sjcl.cipher.aes(aesKeyBits);
        var aesMac = new sjcl.cipher.aes(macKeyBits);
        var hmac = new sjcl.misc.hmac_cbc(aesMac, 16, eb.padding.empty);

        // IV is null, nonce in the first block is kind of IV.
        var IV = [0, 0, 0, 0];
        var encryptedData = sjcl.mode.cbc.encrypt(aes, baBuff, IV, [], true);
        this._log('Encrypted ProcessData input ENC(PDIN): ' + h.fromBits(encryptedData) + ", len=" + ba.bitLength(encryptedData));

        // include plain data in the MAC if non-empty.
        var hmacData = hmac.mac(encryptedData);
        this._log('MAC(ENC(PDIN)): ' + h.fromBits(hmacData));

        // Build the request block.
        var requestBase = sprintf('Packet0_%s_%04X%s%s%s',
            this.reqType,
            plainDataLength,
            h.fromBits(plainData),
            h.fromBits(encryptedData),
            h.fromBits(hmacData)
        );

        this._log('ProcessData request body: ' + requestBase);
        return requestBase;
    },

    _log:  function(x) {
        if (!this.debuggingLog){
            return;
        }

        if (console && console.log){
            console.log(x);
        }

        if (this.logger){
            this.logger(x);
        }
    }
};

/**
 * Base class for parsed raw EB response.
 */
eb.comm.response = function(){

};
eb.comm.response.prototype = {
    /**
     * Parsed status code. 0x9000 = OK.
     * @output
     */
    statusCode: 0,

    /**
     * Parsed status detail.
     * @output
     */
    statusDetail: "",

    /**
     * Function name extracted from the request.
     */
    function: "",

    /**
     * Raw result of the call.
     * Usually processed by child classes.
     */
    result: "",

    /**
     * Returns true if after parsing, code is OK.
     * @returns {boolean}
     */
    isCodeOk: function(){
        return this.statusCode == eb.comm.status.SW_STAT_OK;
    },

    toString: function(){
        return sprintf("Response{statusCode=0x%4X, statusDetail=[%s], userObjectId: 0x%08X, function: [%s], result: [%s]}",
            this.statusCode,
            this.statusDetail,
            eb.misc.inputToHexNum(this.userObjectID, true),
            this.function,
            JSON.stringify(this.result)
        );
    }
};

/**
 * Process data response.
 * Parsed from processData EB response.
 * @extends eb.comm.response
 */
eb.comm.processDataResponse = function(){

};
eb.comm.processDataResponse.inheritsFrom(eb.comm.response, {
    /**
     * Plain data parsed from the response.
     * Nor MACed neither encrypted.
     * @output
     */
    plainData: "",

    /**
     * Protected data parsed from the response.
     * Protected by MAC, encrypted in transit.
     * @output
     */
    protectedData: "",

    /**
     * USerObjectID parsed from the response.
     * Ingeter, 4B.
     */
    userObjectID: 0,

    /**
     * Nonce parsed from the RAW response.
     */
    nonce: "",

    /**
     * MAC value parsed from the message.
     * If macOk is true, it is same as computed MAC.
     */
    mac: "",

    /**
     * Computed MAC value for the message.
     */
    computedMac: "",

    /**
     * Returns true if MAC verification is OK.
     */
    isMacOk: function(){
        var ba = sjcl.bitArray;
        return this.mac
            && this.computedMac
            && ba.bitLength(this.mac) == 16*8
            && ba.bitLength(this.computedMac) == 16*8
            && ba.equal(this.mac, this.computedMac);
    },

    toString: function(){
        return sprintf("ProcessDataResponse{statusCode=0x%4X, statusDetail=[%s], userObjectId: 0x%08X, function: [%s], " +
            "nonce: [%s], protectedData: [%s], plainData: [%s], mac: [%s], computedMac: [%s], macOK: %d",
            this.statusCode,
            this.statusDetail,
            eb.misc.inputToHexNum(this.userObjectID, true),
            this.function,
            sjcl.codec.hex.fromBits(this.nonce),
            sjcl.codec.hex.fromBits(this.protectedData),
            sjcl.codec.hex.fromBits(this.plainData),
            sjcl.codec.hex.fromBits(this.mac),
            sjcl.codec.hex.fromBits(this.computedMac),
            this.isMacOk()
        );
    }
});

/**
 * EB Import public key.
 */
eb.comm.pubKey = function(){};
eb.comm.pubKey.prototype = {
    id: undefined,
    type: undefined,
    certificate: undefined,
    key: undefined,

    toString: function(){
        return sprintf("pubKey{id=0x%04X, type=[%s], certificate:[%s], key:[%s]",
            this.id,
            this.type,
            this.certificate ? sjcl.codec.hex.fromBits(this.certificate) : "null",
            this.key ? sjcl.codec.hex.fromBits(this.key) : "null"
        );
    }
};

/**
 * pubKey response.
 * @extends eb.comm.response
 */
eb.comm.pubKeyResponse = function(x){
    eb.misc.absorb(this, x);
};
eb.comm.pubKeyResponse.inheritsFrom(eb.comm.response, {
    /**
     * Plain data parsed from the response.
     * Nor MACed neither encrypted.
     * @output
     */
    keys: [],

    toString: function(){
        var stringKeys = [], index, len, c;
        for (index = 0, len =this.keys.length; index < len; ++index) {
            c = this.keys[index];
            if (c){
                stringKeys.push(c.toString());
            }
        }

        return sprintf("pubKeyResponse{statusCode=0x%4X, statusDetail=[%s], function: [%s], keys:[%s]",
            this.statusCode,
            this.statusDetail,
            this.function,
            stringKeys.join(", ")
        );
    }
});

/**
 * Raw EB Response parser.
 */
eb.comm.responseParser = function(){

};
eb.comm.responseParser.prototype = {
    /**
     * Parsed response
     * @output
     */
    response: null,

    /**
     * If set to true, response body parsing steps are logged to the console.
     * @input
     */
    debuggingLog: false,

    /**
     * Aux logging function
     * @input
     */
    logger: null,

    /**
     * User can define response parsing function here, called in the main parse body.
     * It is optional function callback, must return response.
     * @input
     */
    _responseParsingFunction: undefined,
    parsingFunction: function(x){
        this._responseParsingFunction = x;
        return this;
    },

    /**
     * Returns true if after parsing, code is OK.
     * @returns {boolean}
     */
    success: function(){
        return this.response.isCodeOk();
    },

    /**
     * Parses common JSON headers from the response, e.g., status, to the provided message.
     * @param resp
     * @param data
     * @returns {eb.comm.response}
     */
    parseCommonHeaders: function(resp, data){
        if (!data || !data.status || !data.function){
            throw new sjcl.exception.invalid("response data invalid");
        }

        // Build new response message.
        resp.statusCode = parseInt(data.status, 16);
        resp.statusDetail = data.statusdetail || "";
        resp.function = data.function;
        resp.result = data.result;
        return resp;
    },

    /**
     * Parse EB response
     *
     * @param data - json response
     * @param resp - response object to put data to.
     * @param options
     * @returns request unwrapped response.
     */
    parse: function(data, resp, options){
        resp = resp || this.response;
        resp = resp || new eb.comm.response();
        this.response = resp;
        this.parseCommonHeaders(resp, data);

        // Build new response message.
        if (!this.success()){
            this._log("Error in processing, status: " + data.status + ", message: " + resp.statusDetail);
        }

        // If parsing function is already set, use it.
        if (this._responseParsingFunction){
            this.response = this._responseParsingFunction(data, resp, this);
            return this.response;
        }

        return resp;
    },

    _log:  function(x) {
        if (!this.debuggingLog){
            return;
        }

        if (console && console.log){
            console.log(x);
        }

        if (this.logger){
            this.logger(x);
        }
    }
};

/**
 * Parser parsing namely ProcessData response.
 * Data returned is encoded in the particular form, encrypted and MACed.
 * This response parser unwraps protected response.
 *
 * @param aesKey
 * @param macKey
 * @extends eb.comm.responseParser
 */
eb.comm.processDataResponseParser = function(aesKey, macKey){
    this.aesKey = aesKey || "";
    this.macKey = macKey || "";
};
eb.comm.processDataResponseParser.inheritsFrom(eb.comm.responseParser, {
    /**
     * Parsed user object ID, integer type.
     * @input
     */
    userObjectId : -1,

    /**
     * AES communication encryption key, hexcoded string.
     * @input
     */
    aesKey: "",

    /**
     * AES MAC communication key, hexcoded string.
     * @input
     */
    macKey: "",

    /**
     * Parse EB response
     *
     * @param data - json response
     * @param resp - response object to put data to.
     * @param options
     * @returns request unwrapped response.
     */
    parse: function(data, resp, options){
        resp = resp || this.response;
        resp = resp || new eb.comm.processDataResponse();
        this.response = resp;

        this.parseCommonHeaders(resp, data);
        if (!this.success()){
            this._log("Error in processing, status: " + data.status + ", message: " + resp.statusDetail);
            return resp;
        }

        // Shortcuts.
        var h = sjcl.codec.hex;
        var ba = sjcl.bitArray;

        // Build new response message.
        var resultBuffer = resp.result;
        var baResult = h.toBits(resultBuffer.substring(0, resultBuffer.indexOf("_")));
        var plainLen = ba.extract(baResult, 0, 2*8);
        var plainBits = ba.bitSlice(baResult, 2*8, 2*8+plainLen*8);
        var protectedBits = ba.bitSlice(baResult, 2*8+plainLen*8);
        var protectedBitsBl = ba.bitLength(protectedBits);

        // Decrypt and verify
        var aesKeyBits = eb.misc.inputToBits(this.aesKey);
        var macKeyBits = eb.misc.inputToBits(this.macKey);
        var aes = new sjcl.cipher.aes(aesKeyBits);
        var aesMac = new sjcl.cipher.aes(macKeyBits);
        var hmac = new sjcl.misc.hmac_cbc(aesMac, 16, eb.padding.empty);

        // Verify MAC.
        var macTagOffset = protectedBitsBl - 16*8;
        var dataToMac = ba.bitSlice(protectedBits, 0, macTagOffset);
        if ((ba.bitLength(dataToMac) & 127) != 0){
            throw new sjcl.exception.corrupt("Padding size invalid");
        }

        resp.mac = ba.bitSlice(protectedBits, macTagOffset);
        if (ba.bitLength(resp.mac) != 16*8){
            throw new sjcl.exception.corrupt("MAC corrupted");
        }

        resp.computedMac = hmac.mac(dataToMac);
        if (!resp.mac || !ba.equal(resp.mac, resp.computedMac)){
            throw new sjcl.exception.corrupt("Padding is not valid"); //TODO: padding oracle?
        }

        // Decrypt.
        var dataToDecrypt = ba.bitSlice(protectedBits, 0, macTagOffset);
        if ((ba.bitLength(dataToDecrypt) & 127) != 0){
            throw new sjcl.exception.corrupt("Ciphertext block invalid");
        }

        // IV is null, nonce in the first block is kind of IV.
        var IV = [0, 0, 0, 0];
        var decryptedData = sjcl.mode.cbc.decrypt(aes, dataToDecrypt, IV, [], false);
        this._log("decryptedData: " + h.fromBits(decryptedData) + ", len=" + ba.bitLength(decryptedData));

        // Check the flag.
        var responseFlag = ba.extract(decryptedData, 0, 8);
        if (responseFlag != 0xf1){
            throw new sjcl.exception.corrupt("Given data packet is not a response (flag mismatch)");
        }

        // Get user object.
        resp.userObjectID = ba.extract32(decryptedData, 8);

        // Get nonce, mangled.
        var returnedMangledNonce = ba.bitSlice(decryptedData, 5*8, 5*8+8*8);
        resp.nonce = eb.comm.demangleNonce(returnedMangledNonce);

        // Response = plainData + decryptedData.
        resp.protectedData = ba.bitSlice(decryptedData, 5*8+8*8);
        resp.plainData = plainBits;
        this._log("responseData: " + h.fromBits(resp.protectedData));

        return resp;
    }
});

/**
 * Simple connector to the EB interface.
 * Configurable for https/http GET/POST
 */
eb.comm.connector = function(){

};
eb.comm.connector.prototype = {
    objName: "connector",
    /**
     * Method to do REST request with. GET or POST are allowed.
     * @input
     */
    requestMethod: eb.comm.REQ_METHOD_POST,

    /**
     * Scheme used to contact remote API.
     * @input
     * @default https
     */
    requestScheme: "https",

    /**
     * Request timeout in milliseconds.
     * @input
     * @default 30000
     */
    requestTimeout: 30000,

    /**
     * Endpoint where EB API listens
     * @input
     */
    remoteEndpoint: "site1.enigmabridge.com",

    /**
     * Port of the remote endpoint
     * @input
     * @default 11180
     */
    remotePort: 11180,

    /**
     * Ajax call settings. User can modify default behavior by specifying settings here.
     * @input
     */
    ajaxSettings: {},

    /**
     * If set to true, request body building steps are logged.
     * @input
     */
    debuggingLog: false,

    /**
     * Aux logging function
     * @input
     */
    logger: null,

    /**
     * Request start time. Measure how long it took.
     * @output
     */
    requestTime: 0,

    /**
     * Raw request generated by the build call.
     * e.g., transmitted in the GET query method parameters / URL.
     */
    reqHeader: undefined,

    /**
     * Body part of the request.
     * e.g., transmitted in body of the HTTP message.
     */
    reqBody: undefined,

    /**
     * Response generated by response array.
     * @output
     */
    response: undefined,

    /**
     * RAW response from the server.
     * @output
     */
    rawResponse: undefined,

    /**
     * Response parser used to parse the response.
     * If not defined before calling doRequest method, default response parser is created.
     */
    responseParser: undefined,

    /**
     * Socket equivalent request, for debugging.
     * Generated when building the request.
     * @private
     */
    _socketRequest: "",

    _doneCallback: function(response, requestObj, data){},
    _failCallback: function(failType, data){},
    _alwaysCallback: function(requestObj, data){},

    done: function(x){
        this._doneCallback = x;
        return this;
    },

    fail: function(x){
        this._failCallback = x;
        return this;
    },

    always: function(x){
        this._alwaysCallback = x;
        return this;
    },

    /**
     * Returns if the EB returned with success.
     * Note: Data still may have invalid MAC.
     * @returns {*|boolean}
     */
    wasSuccessful: function(){
        return this.responseParser.success();
    },

    /**
     * Process configuration from the config object.
     * @param configObject java object with the configuration.
     */
    configure: function(configObject){
        if (!configObject){
            this._log("Invalid config object");
            return;
        }

        // Advanced connection settings.
        var ak = eb.misc.absorbKey;
        ak(this, configObject, "remoteEndpoint");
        ak(this, configObject, "remotePort");
        ak(this, configObject, "requestMethod");
        ak(this, configObject, "requestScheme");
        ak(this, configObject, "requestTimeout");
        ak(this, configObject, "debuggingLog");
        ak(this, configObject, "logger");
        ak(this, configObject, "responseParser");
        ak(this, configObject, "reqHeader");
        ak(this, configObject, "reqBody");
    },

    /**
     * Initializes state and builds request
     * @param requestHeader
     * @param requestBody
     */
    build: function(requestHeader, requestBody){
        if (requestHeader) {
            this.reqHeader = requestHeader;
        }

        if (requestBody) {
            this.reqBody = requestBody;
        }
    },

    /**
     * Builds EB request.
     *
     * @param requestHeader
     * @param requestBody
     * @returns request body string.
     */
    doRequest: function(requestHeader, requestBody){
        if (!this.reqBody){
            this.build(requestHeader, requestBody);
        }

        var url = this.getApiUrl();
        var apiData = this.getApiRequestData();
        var ajaxSettings = {
            url: url,
            type: this.requestMethod,
            dataType: 'json',
            timeout: this.requestTimeout,
            data: this.requestMethod == eb.comm.REQ_METHOD_POST ? JSON.stringify(apiData) : null
        };

        // Extend ajax settings with user provided settings.
        $.extend(ajaxSettings, this.ajaxSettings || {});
        var ebc = this;

        // Do the remote call
        this._log("Sending remote request...");
        this.requestTime = new Date().getTime();
        $.ajax(ajaxSettings)
            .done(function (data, textStatus, jqXHR) {
                ebc._requestFinished();
                ebc._log("Response status: " + textStatus);
                ebc._log("Raw response: " + JSON.stringify(data));

                // Process AJAX success. By default, response parsing is done. Subclass may modify this behavior.
                ebc.processAnswer(data, textStatus, jqXHR);

            }).fail(function (jqXHR, textStatus, errorThrown) {
            ebc._requestFinished();
            ebc._log("Error: " + sprintf("Error: status=[%d], responseText: [%s], error: [%s], status: [%s] misc: %s",
                    jqXHR.status, jqXHR.responseText, errorThrown, textStatus, JSON.stringify(jqXHR)));

            // Process AJAX fail, subclass can modify behavior, hook something.
            ebc.processFail(jqXHR, textStatus, errorThrown);

        }).always(function (data, textStatus, jqXHR) {
            // Process AJAX always, subclass can modify behavior, hook something.
            ebc.processAlways(data, textStatus, jqXHR);

        });
    },

    /**
     * Request finished, measure time.
     * @private
     */
    _requestFinished: function(){
        this.requestTime = (new Date().getTime() - this.requestTime);
        this._log("Request finished in " + this.requestTime + " ms");
    },

    /**
     * Processing response from the server.
     *
     * @param data
     * @param textStatus
     * @param jqXHR
     */
    processAnswer: function(data, textStatus, jqXHR){
        this.rawResponse = data;
        try {
            var responseParser = this.getResponseParser();
            this.response = this.getResponseObject();
            this.response = responseParser.parse(data, this.response);

            if (responseParser.success()) {
                this._log("Processing complete, response: " + this.response.toString());
                if (this._doneCallback){
                    this._doneCallback(this.response, this, {
                        'jqXHR':jqXHR,
                        'textStatus':textStatus,
                        'response':this.response,
                        'requestObj':this
                    });
                }

            } else {
                this._log("Failure, status: " + this.response.toString());
                if (this._failCallback){
                    this._failCallback(eb.comm.status.PDATA_FAIL_RESPONSE_FAILED, {
                        'jqXHR':jqXHR,
                        'textStatus':textStatus,
                        'response':this.response,
                        'failType':eb.comm.status.PDATA_FAIL_RESPONSE_FAILED,
                        'requestObj':this
                    });
                }
            }

        } catch(e){
            this._log("Exception when processing the response: " + e);
            if (this._failCallback){
                this._failCallback(eb.comm.status.PDATA_FAIL_RESPONSE_PARSING, {
                    'jqXHR':jqXHR,
                    'textStatus':textStatus,
                    'failType':eb.comm.status.PDATA_FAIL_RESPONSE_PARSING,
                    'requestObj':this,
                    'parseException':e
                });
            }

            throw e;
        }
    },

    /**
     * To be overriden.
     * Called on AJAX fail.
     *
     * @param jqXHR
     * @param textStatus
     * @param errorThrown
     */
    processFail: function(jqXHR, textStatus, errorThrown){
        if (this._failCallback) {
            this._failCallback(eb.comm.status.PDATA_FAIL_CONNECTION, {
                'jqXHR':jqXHR,
                'textStatus':textStatus,
                'errorThrown':errorThrown,
                'failType':eb.comm.status.PDATA_FAIL_CONNECTION,
                'requestObj': this
            });
        }
    },

    /**
     * To be overriden.
     * Called on AJAX always.
     *
     * @param data
     * @param textStatus
     * @param jqXHR
     */
    processAlways: function(data, textStatus, jqXHR){
        if (this._alwaysCallback) {
            this._alwaysCallback(this, {
                'responseRawData':data,
                'textStatus':textStatus,
                'jqXHR':jqXHR,
                'requestObj': this
            });
        }
    },

    /**
     * Returns remote API URL to query with Ajax.
     * According to current request settings.
     * Note: Request has to be built when calling this function.
     *
     * @returns {*}
     */
    getApiUrl: function(){
        return sprintf("%s://%s:%d/",
            this.requestScheme,
            this.remoteEndpoint,
            this.remotePort);
    },

    /**
     * Returns Ajax request data.
     * According to current request settings.
     * Note: Request has to be built when calling this function.
     *
     * @returns {*}
     */
    getApiRequestData: function(){
        return this.reqBody;
    },

    /**
     * Returns response parser when is needed. May lazily initialize parser.
     * Override point.
     *
     * @returns {*}
     */
    getResponseParser: function(){
        this.responseParser = new eb.comm.responseParser();
        this.responseParser.debuggingLog = true;
        this.responseParser.logger = this.logger;
        return this.responseParser;
    },

    /**
     * Returns respone object to be used by the response parser.
     * Enables to specify a subclass of the original response class.
     */
    getResponseObject: function(){
        return new eb.comm.response();
    },

    /**
     * Returns raw EB request for raw socket transport method.
     * For debugging & verification.
     *
     * @returns {string}
     */
    getSocketRequest: function(){
        this._socketRequest = {};
        $.extend(true, this._socketRequest, this.reqHeader || {});
        $.extend(true, this._socketRequest, this.reqBody || {});
        return this._socketRequest;
    },

    /**
     * Logger wrapper. Allowing to log messages both to console and provided logger.
     * @param x message to log.
     * @private
     */
    _log:  function(x) {
        if (!this.debuggingLog){
            return;
        }

        if (console && console.log){
            console.log(x);
        }

        if (this.logger){
            this.logger(x);
        }
    }
};

/**
 * API request using the connector.
 * Standard request with
 *   - API version,
 *   - API Key,
 *   - API lower 4 bytes identifier (e.g., user object id),
 *   - call function,
 *   - nonce
 *
 * @param apiKey
 * @param apiKeyLow4Bytes
 */
eb.comm.apiRequest = function(apiKey, apiKeyLow4Bytes){
    this.apiKey = apiKey;
    this.apiKeyLow4Bytes = apiKeyLow4Bytes;
};
eb.comm.apiRequest.inheritsFrom(eb.comm.connector, {
    objName: "apiRequest",

    /**
     * Function to call
     * @input
     * @default ProcessData
     */
    callFunction: "ProcessData",

    /**
     * User API key
     * @input
     */
    apiKey: undefined,

    /**
     * Lower 4 API bytes to use for api token.
     * For process data this may be UseObjectId.
     * @input
     */
    apiKeyLow4Bytes: undefined,

    /**
     * Version of EB API.
     * @input
     * @default 1.0
     */
    apiVersion: "1.0",

    /**
     * Nonce generated for the request.
     * @input
     * @output
     */
    nonce: undefined,

    /**
     * Composite API key for the request.
     * Generated before request is sent.
     * @private
     */
    _apiKeyReq: "",

    /**
     * Builds API key token.
     * Consists of apiKey and low4B identifier.
     * Can be specified by parameters or currently set values are set.
     * Result is returned and set to the property.
     *
     * @param apiKey
     * @param apiLow4b  integer or hex-coded string.
     */
    buildApiBlock: function(apiKey, apiLow4b){
        apiKey = apiKey || this.apiKey;
        apiLow4b = apiLow4b || this.apiKeyLow4Bytes;
        this._apiKeyReq = sprintf("%s%010x", apiKey, eb.misc.inputToHexNum(apiLow4b));
        return this._apiKeyReq;
    },

    /**
     * Builds standard request header from existing fields.
     */
    buildReqHeader: function() {
        this.reqHeader = {
            objectid:this._apiKeyReq,
            function:this.callFunction,
            nonce:this.getNonce(),
            version:this.apiVersion
        };
        return this.reqHeader;
    },

    /**
     * Returns currently set nonce.
     * Generates a new one if is undefined.
     * @returns {*}
     */
    getNonce: function(){
        if (!this.nonce){
            return this.genNonce();
        }

        return this.nonce;
    },

    /**
     * Generates new nonce, sets it as a current nonce for the request.
     * @returns {string|*|string}
     */
    genNonce: function(){
        this.nonce = eb.misc.genHexNonce(16);
        return this.nonce;
    },

    /**
     * Process configuration from the config object.
     * @param configObject java object with the configuration.
     */
    configure: function(configObject){
        if (!configObject){
            this._log("Invalid config object");
            return;
        }

        // Configure with parent.
        eb.comm.apiRequest.superclass.configure.call(this, configObject);

        // Configure this.
        var ak = eb.misc.absorbKey;
        ak(this, configObject, "callFunction");
        ak(this, configObject, "apiKey");
        ak(this, configObject, "apiKeyLow4Bytes");
        ak(this, configObject, "nonce");
    },

    /**
     * Returns remote API URL to query with Ajax.
     * According to current request settings.
     * Note: Request has to be built when calling this function.
     *
     * @returns {*}
     */
    getApiUrl: function(){
        if (this.requestMethod == eb.comm.REQ_METHOD_POST || (this.requestMethod == eb.comm.REQ_METHOD_GET && !this.reqBody)){
            return sprintf("%s://%s:%d/%s/%s/%s/%s",
                this.requestScheme,
                this.remoteEndpoint,
                this.remotePort,
                this.apiVersion,
                this._apiKeyReq,
                this.callFunction,
                this.getNonce());

        } else if (this.requestMethod == eb.comm.REQ_METHOD_GET){
            return sprintf("%s://%s:%d/%s/%s/%s/%s%s",
                this.requestScheme,
                this.remoteEndpoint,
                this.remotePort,
                this.apiVersion,
                this._apiKeyReq,
                this.callFunction,
                this.getNonce(),
                this.reqBody !== undefined ? ("/" + JSON.stringify(this.reqBody)) : "");

        } else {
            throw new eb.exception.invalid("Invalid configuration, unknown method: " + this.requestMethod);
        }
    },

    /**
     * Returns Ajax request data.
     * According to current request settings.
     * Note: Request has to be built when calling this function.
     *
     * @returns {*}
     */
    getApiRequestData: function(){
        if (this.requestMethod == eb.comm.REQ_METHOD_POST) {
            return this.reqBody;
        } else {
            return {};
        }
    },

    /**
     * Initializes state and builds request
     * @param requestHeader
     * @param requestBody
     */
    build: function(requestHeader, requestBody){
        if (requestHeader.apiKey && requestHeader.apiKeyLow4Bytes){
            this.buildApiBlock(requestHeader.apiKey, requestHeader.apiKeyLow4Bytes);
        } else {
            this.buildApiBlock();
        }

        if (requestBody){
            this.reqBody = requestBody;
        }

        if (requestHeader){
            this.reqHeader = requestHeader;
        }

        this.buildReqHeader();
    },
});

/**
 * Process data request to the EB.
 * @param apiKey
 * @param aesKey
 * @param macKey
 * @param userObjectId
 */
eb.comm.processData = function(apiKey, aesKey, macKey, userObjectId){
    this.apiKey = apiKey || "";
    this.aesKey = aesKey || "";
    this.macKey = macKey || "";
    this.userObjectId = userObjectId || -1;
    this.callFunction = "ProcessData";
};
eb.comm.processData.inheritsFrom(eb.comm.apiRequest, {
    /**
     * User object ID to perform operation with, integer type.
     * @input
     */
    userObjectId : -1,

    /**
     * AES communication encryption key, hexcoded string.
     * @input
     */
    aesKey: "",

    /**
     * AES MAC communication key, hexcoded string.
     * @input
     */
    macKey: "",

    /**
     * Type of the data request.
     * PLAINAES for AES keys, RSA2048 for RSA-2048 keys.
     *
     * @input
     * @default PLAINAES
     */
    callRequestType: "PLAINAES",

    /**
     * Request builder used to build the request.
     * @output
     */
    processDataRequestBodyBuilder: null,

    /**
     * Request block generated by request builder.
     * @private
     */
    _requestBlock: "",

    /**
     * Process configuration from the config object.
     * @param configObject java object with the configuration.
     */
    configure: function(configObject){
        if (!configObject){
            this._log("Invalid config object");
            return;
        }

        var toConfig = configObject;
        if ("userObjectId" in configObject){
            toConfig = $.extend(true, toConfig, {apiKeyLow4Bytes : configObject.userObjectId});
        }
        if ("encKey" in configObject){
            toConfig = $.extend(true, toConfig, {aesKey : configObject.encKey});
        }

        // Configure with parent.
        eb.comm.processData.superclass.configure.call(this, toConfig);

        // Configure this.
        var ak = eb.misc.absorbKey;
        ak(this, toConfig, "aesKey");
        ak(this, toConfig, "macKey");
        ak(this, toConfig, "userObjectId");
        ak(this, toConfig, "callRequestType");
    },

    /**
     * Initializes state and builds request
     * @param plainData
     * @param requestData
     */
    build: function(plainData, requestData){
        this._log("Building request body");

        // Request header data.
        this.buildApiBlock(this.apiKey, this.userObjectId);
        this.buildReqHeader();

        // Build a new EB request.
        this.processDataRequestBodyBuilder = new eb.comm.processDataRequestBodyBuilder();
        this.processDataRequestBodyBuilder.aesKey = this.aesKey;
        this.processDataRequestBodyBuilder.macKey = this.macKey;
        this.processDataRequestBodyBuilder.userObjectId = this.userObjectId;
        this.processDataRequestBodyBuilder.reqType = this.callRequestType;
        this.processDataRequestBodyBuilder.debuggingLog = this.debuggingLog;
        this.processDataRequestBodyBuilder.logger = this.logger;
        this.processDataRequestBodyBuilder.nonce = this.getNonce();

        this._requestBlock = this.processDataRequestBodyBuilder.build(plainData, requestData);
        this.reqBody = {data : this._requestBlock};

        var nonce = this.getNonce();
        var url = this.getApiUrl();
        var apiData = this.getApiRequestData();

        this._log("Nonce: " + nonce);
        this._log("URL: " + url + ", method: " + this.requestMethod);
        this._log("UserData: " + JSON.stringify(apiData));
        this._log("SocketReq: " + JSON.stringify(this.getSocketRequest()));
    },

    /**
     * Builds EB request.
     *
     * @param requestHeader
     * @param requestBody
     * @returns request body string.
     */
    doRequest: function(requestHeader, requestBody){
        if (!this.reqBody){
            this.build(requestHeader, requestBody);
        }

        eb.comm.processData.superclass.doRequest.call(this);
    },

    /**
     * Returns remote API URL to query with Ajax.
     * According to current request settings.
     * Note: Request has to be built when calling this function.
     *
     * @returns {*}
     */
    getApiUrl: function(){
        if (this.requestMethod == eb.comm.REQ_METHOD_POST){
            return sprintf("%s://%s:%d/%s/%s/%s/%s",
                this.requestScheme,
                this.remoteEndpoint,
                this.remotePort,
                this.apiVersion,
                this._apiKeyReq,
                this.callFunction,
                this.getNonce());

        } else if (this.requestMethod == eb.comm.REQ_METHOD_GET){
            return sprintf("%s://%s:%d/%s/%s/%s/%s/%s",
                this.requestScheme,
                this.remoteEndpoint,
                this.remotePort,
                this.apiVersion,
                this._apiKeyReq,
                this.callFunction,
                this.getNonce(),
                this.reqBody.data);

        } else {
            throw new eb.exception.invalid("Invalid configuration, unknown method: " + this.requestMethod);
        }
    },

    /**
     * Returns Ajax request data.
     * According to current request settings.
     * Note: Request has to be built when calling this function.
     *
     * @returns {*}
     */
    getApiRequestData: function(){
        if (this.requestMethod == eb.comm.REQ_METHOD_POST) {
            return this.reqBody;
        } else {
            return {};
        }
    },

    /**
     * Returns response parser when is needed. May lazily initialize parser.
     * Override point.
     *
     * @returns {*}
     */
    getResponseParser: function(){
        this.responseParser = new eb.comm.processDataResponseParser();
        this.responseParser.debuggingLog = true;
        this.responseParser.logger = this.logger;
        this.responseParser.aesKey = this.aesKey;
        this.responseParser.macKey = this.macKey;
        return this.responseParser;
    }
});

/**
 * Request obtaining import public keys.
 */
eb.comm.getPubKey = function(){
    this.callFunction = "GetImportPublicKey";
};
eb.comm.getPubKey.inheritsFrom(eb.comm.apiRequest, {
    objName: "getPubKey",

    /**
     * Initializes state and builds request
     */
    build: function(){
        this._log("Building request body");

        // Request header data.
        this.buildApiBlock(this.apiKey, this.userObjectId);
        this.buildReqHeader();
        this.reqBody = {};

        var nonce = this.getNonce();
        var url = this.getApiUrl();
        this._log("Nonce generated: " + nonce);
        this._log("URL: " + url + ", method: " + this.requestMethod);
        this._log("SocketReq: " + JSON.stringify(this.getSocketRequest()));
    },

    /**
     * Returns response parser when is needed. May lazily initialize parser.
     * Override point.
     *
     * @returns {*}
     */
    getResponseParser: function(){
        // Generic parser with given parsing function.
        var pubKeyParser = new eb.comm.responseParser();
        pubKeyParser.parsingFunction(function(data, resp, parser){
            var response = new eb.comm.pubKeyResponse(resp);

            /**
             * Response:
             * {"function":"GetImportPublicKey","result":[
             * {"certificate":null,"id":263,"type":"rsa","key":"81 00 03 01 00 01 82 01 00 e1 e0 6b 76 f9 7b cd 82 7c 98 cc 3b 41 a8 50 40 cc dc 61 cf 72 58 14 fd b9 e9 5f 53 06 29 12 e9 39 b1 3c f1 ce 27 d0 7b 44 78 57 7a 20 9c ff db de a2 90 29 19 c0 87 08 8f 85 d5 ed 1d 0b 0c dc ef d8 23 b6 49 71 4f 69 95 31 d9 b8 10 08 af 63 5e a9 79 67 82 fe 3c 40 3c 0e 5d e2 15 58 78 06 f3 0e 16 09 4d a0 16 05 89 e9 80 1c ba f4 0e 63 fd 2d 72 cb 85 cb 7f c1 9a 37 7b 0f a9 2e 7d 90 8e 6a 69 aa bc 4c 5b a2 2d 32 e5 58 7e 0e d8 12 b4 c1 62 66 84 98 fd e5 54 08 93 c1 c0 88 41 51 60 93 93 d8 cc cd ee 3e eb 88 ae 91 24 32 16 b2 26 92 73 f9 a5 23 b9 5c cf e5 b1 f9 e5 4f d2 4f 73 77 a2 ab d7 c6 43 9e c4 60 97 c4 70 1e 58 c2 49 33 02 2d 43 8b 77 67 3c 30 0e a6 81 e4 73 d2 46 18 f9 79 40 3d a6 79 dd 5c 3c e0 b7 4c 16 a9 5c 96 47 40 7c 2c dc 11 3b 92 75 44 ec d8 c6 95 "},
             * {"certificate":null,"id":264,"type":"rsa","key":"81 00 03 01 00 01 82 01 00 e1 e0 6b 76 f9 7b cd 82 7c 98 cc 3b 41 a8 50 40 cc dc 61 cf 72 58 14 fd b9 e9 5f 53 06 29 12 e9 39 b1 3c f1 ce 27 d0 7b 44 78 57 7a 20 9c ff db de a2 90 29 19 c0 87 08 8f 85 d5 ed 1d 0b 0c dc ef d8 23 b6 49 71 4f 69 95 31 d9 b8 10 08 af 63 5e a9 79 67 82 fe 3c 40 3c 0e 5d e2 15 58 78 06 f3 0e 16 09 4d a0 16 05 89 e9 80 1c ba f4 0e 63 fd 2d 72 cb 85 cb 7f c1 9a 37 7b 0f a9 2e 7d 90 8e 6a 69 aa bc 4c 5b a2 2d 32 e5 58 7e 0e d8 12 b4 c1 62 66 84 98 fd e5 54 08 93 c1 c0 88 41 51 60 93 93 d8 cc cd ee 3e eb 88 ae 91 24 32 16 b2 26 92 73 f9 a5 23 b9 5c cf e5 b1 f9 e5 4f d2 4f 73 77 a2 ab d7 c6 43 9e c4 60 97 c4 70 1e 58 c2 49 33 02 2d 43 8b 77 67 3c 30 0e a6 81 e4 73 d2 46 18 f9 79 40 3d a6 79 dd 5c 3c e0 b7 4c 16 a9 5c 96 47 40 7c 2c dc 11 3b 92 75 44 ec d8 c6 95 "}]
             * ,"status":"9000","statusdetail":"(OK)SW_STAT_OK","version":"1.0"}
             */
            if (!data.result || !data.result.length) {
                parser._log("Result is not an array");
                return;
            }

            response.keys = [];
            var index, len, cur, cKey, ok;
            for (index = 0, len = data.result.length; index < len; ++index) {
                cur = data.result[index];
                cKey = new eb.comm.pubKey();
                if (!("id" in cur && "key" in cur)){
                    continue;
                }

                cKey.id = cur.id;
                cKey.type = cur.type;
                if ("certificate" in cur && cur.certificate){
                    var noSpaceCrt = cur.certificate.replace(/\s+/g,'');
                    cKey.certificate = sjcl.codec.hex.toBits(noSpaceCrt);
                }

                if ("key" in cur && cur.key){
                    var noSpaceKey = cur.key.replace(/\s+/g,'');
                    cKey.key = sjcl.codec.hex.toBits(noSpaceKey);
                }

                response.keys.push(cKey);
            }
            return response;
        });

        this.responseParser = pubKeyParser;
        return this.responseParser;
    }
});

/**
 * HOTP feature.
 */
eb.comm.hotp = {
    // Template for generation of new user context.
    // USER_AUTH_CTX structure: version 1B | user_id 8B | flags 4B | #total_failed_tries 1B | #max_total_failed_tries 1B | TLV_auth_method1 | ... | TLV_auth_method_n |
    //                   VR    USER-ID-8B     flags   #e #m
    ctxTemplateUsr:     '01         %s       00000000 00 04',

    // HOTP method:      tt  len cf mf HOTP 8B counter  ct  Dg  Ln Secret - template
    ctxTemplateHotp:    '3f 001d 00 03 0000000000000000 02 %02x 10 11223344556677881122334455667788',

    // Passwd method:    tt len  cf mf hl   password hash
    ctxTemplatePasswd:  '40 %04x 00 03 %02x %s',

    // VR - version
    // #e - total failed entries
    // #m - max total failed entries
    // tt - auth method type. 0x3f = HOTP, 0x40 = password auth.
    // len - overall auth record length
    // Dg - digits
    // Ln - secret length
    // cf - current fails
    // mf - maximum number of fails
    // hl - hash length

    // Constants
    TLV_TYPE_USERAUTHCONTEXT: 0xa3,
    TLV_TYPE_NEWAUTHCONTEXT: 0xa8,
    TLV_TYPE_UPDATEAUTHCONTEXT: 0xa7,
    TLV_TYPE_HOTPCODE: 0xa5,
    TLV_TYPE_PASSWORDHASH: 0xa4,
    USERAUTHCTX_MAIN_USERID_LENGTH: 8,
    USERAUTH_FLAG_HOTP: 0x0001,
    USER_AUTH_TYPE_HOTP: 63,
    USERAUTH_FLAG_PASSWD: 0x0002,
    USER_AUTH_TYPE_PASSWD: 64,
    USERAUTH_FLAG_GLOBALTRIES: 0x0004,
    USER_AUTH_TYPE_GLOBALTRIES: 62,

    HOTP_DIGITS_DEFAULT: 6,

    /**
     * Builds generalized context template from the options.
     * May contain two authentization methods at the moment, HOTP, Password.
     * @param options
     *      userId:  user ID aditional entropy. By default 0000000000000001
     *      methods: flags for methods to include in context. USERAUTH_FLAG_HOTP, USERAUTH_FLAG_PASSWD.
     *      hotp: {digits}: hotp digits in the template. HOTP code length.
     *      passwd: {hash}: password hash used for authentication.
     */
    getCtxTemplate: function(options){
        var defaults = {
            userId: eb.comm.hotp.userIdToHex("01"),
            methods: eb.comm.hotp.USERAUTH_FLAG_HOTP,
            hotp:{
                digits: eb.comm.hotp.HOTP_DIGITS_DEFAULT
            },
            passwd:{
                hash: undefined
            }
        };

        options = $.extend(true, defaults, options || {});
        var useHotp = options && ((options.methods & eb.comm.hotp.USERAUTH_FLAG_HOTP) > 0);
        var usePass = options && ((options.methods & eb.comm.hotp.USERAUTH_FLAG_PASSWD) > 0);

        var userId = eb.comm.hotp.userIdToHex(options && options.userId);

        // Build base context.
        var ctx = sprintf(this.ctxTemplateUsr, userId);

        // Add HOTP method, if desired.
        if (useHotp){
            var digits = options && options.hotp && options.hotp.digits;
            ctx += sprintf(this.ctxTemplateHotp, digits);
        }

        // Add Password method, if desired.
        if (usePass){
            var hash = options && options.passwd && options.passwd.hash;
            if (hash === undefined || hash.length == 0) {
                throw new eb.exception.invalid("Password auth method specified, empty hash");
            }

            hash = eb.misc.padHexToEven(eb.misc.inputToHex(hash));
            var hashLen = hash.length / 2;
            var totalLen = 3 + hashLen;

            ctx += sprintf(this.ctxTemplatePasswd, totalLen, hashLen, hash);
        }

        return sjcl.codec.hex.toBits(ctx.replace(/ /g,''));
    },

    /**
     * Encrypts HOTP CTX template with random key & MACs with random key to obtain encrypted
     * template blob. Required for new user HOTPCTX init.
     *
     * @param tpl
     * @returns {*}
     */
    prepareUserContext: function(tpl){
        var randomEncKey = sjcl.random.randomWords(8);
        var randomMacKey = sjcl.random.randomWords(8);

        var aes = new sjcl.cipher.aes(randomEncKey);
        var aesMac = new sjcl.cipher.aes(randomMacKey);
        var hmac = new sjcl.misc.hmac_cbc(aesMac, 16, eb.padding.empty);

        // Padding of the TPL.
        tpl = eb.padding.pkcs7.pad(tpl);

        // IV is null, nonce in the first block is kind of IV.
        var IV = [0, 0, 0, 0];
        var encryptedData = sjcl.mode.cbc.encrypt(aes, tpl, IV, [], true);
        var hmacData = hmac.mac(encryptedData);

        return sjcl.bitArray.concat(encryptedData, hmacData);
    },

    /**
     * Converts HOTP number given as string to hex-coded array.
     * Used when authenticating via HOTP code.
     *
     * Warning: does not perform radix change. 12345678 -> d2h(12)|d2h(34)|d2h(56)|d2h(78) = 0c22384e
     * d2h(12345678) = 0BC614E
     *
     * @param hotpCode numeric authentication code coded as string in decimal.
     * @param length HOTP code length. Default = 8. Usually 6,8,10,12
     * @ref: intToExpandedShortByteArray()
     */
    hotpCodeToHexCoded: function(hotpCode, length){
        length = length || eb.comm.hotp.HOTP_DIGITS_DEFAULT;
        var inputCode = "000000000000000000000000000" + hotpCode;
        var i,idx,cur,curNum,codeLength = inputCode.length;
        var result = "";
        for(i=0; i<(length+1)/2; i++){
            idx = codeLength-(i+1)*2;
            cur = inputCode.substring(idx, idx + 2);
            curNum = parseInt(cur, 10);
            result = sprintf("%04X", curNum) + result;
        }
        return result;
    },

    /**
     * Function used to normalize user ID bitArray representation - 2 words width.
     * @param x
     */
    userIdBitsNormalize: function(x){
        var ln = x.length;
        if (ln == 2){
            return x;
        } else if (ln == 0){
            return [0,0];
        } else if (ln == 1){
            return [0, x[0]];
        } else {
            return [x[0], x[1]];
        }
    },

    /**
     * Converts user id argument to the 64bit SJCL bitArray.
     * @param x
     *      if x is a number, it is converted to SJCL bitArray. Warning, 32bit numbers are supported only.
     *      if x is a string, it is considered as hex coded string.
     *      if x is an array it is considered as SJCL bitArray.
     */
    userIdToBits: function(x){
        var ln;
        if (typeof(x) === 'number'){
            return eb.comm.hotp.userIdBitsNormalize(sjcl.codec.hex.toBits(sprintf("%x", x)));

        } else if (typeof(x) === 'string') {
            x = x.trim();
            ln = x.length;
            if (ln > 16 || ln === 0 || !(x.match(/^[0-9A-Fa-f]+$/))){
                throw new eb.exception.invalid("User ID string invalid");
            }

            return eb.comm.hotp.userIdBitsNormalize(sjcl.codec.hex.toBits(x));

        } else {
            return eb.comm.hotp.userIdBitsNormalize(x);

        }
    },

    /**
     * Converts user id argument to the hexcoded string coding 8 bytes.
     * @param x -
     *      if x is a number, will be converted to a hex string. Warning, 32bit numbers are supported only.
     *      if x is a string, it is considered as hex coded string. It is padded to 8 bytes.
     *      if x is an array it is considered as SJCL bitArray.
     */
    userIdToHex: function(x){
        var tmp,ln;
        if (typeof(x) === 'number'){
            // number
            return sprintf("%016x", x);

        } else if (typeof(x) === 'string') {
            // hex-coded string
            x = x.trim();
            ln = x.length;
            if (ln > 16 || ln === 0 || !(x.match(/^[0-9A-Fa-f]+$/))){
                throw new eb.exception.invalid("User ID string invalid");
            }

            return ln < 16 ? ('0'.repeat(16-ln)) + x : x;

        } else {
            // SJCL bitArray
            tmp = sjcl.codec.hex.fromBits(x);
            ln = tmp.length;
            if (ln > 16){
                throw new eb.exception.invalid("User ID string invalid");
            }
            return ln < 16 ? ('0'.repeat(16-ln)) + tmp : tmp;
        }
    },

    /**
     * Utility function to compute HOTP value, returned as string coded in decimal base.
     * @see https://tools.ietf.org/html/rfc4226
     * @param key           bitArray key | hexcoded key
     * @param ctr           8byte HOTP counter. bitArray or hexcoded string or numeric
     * @param length        length of the HOTP code.
     */
    hotpCompute: function(key, ctr, length){
        var hmac = new sjcl.misc.hmac(eb.misc.inputToBits(key), sjcl.hash.sha1);

        // Ctr is 8 byte counter, big endian coded. Make sure it has correct length.
        var ctrBits = eb.misc.inputToBits(ctr);
        var ctrHex = eb.misc.inputToHex(ctr).trim();
        var ctrHexLn = ctrHex.length;
        if (ctrHexLn > 16){
            throw new eb.exception.invalid("Counter value is too big");

        } else if (ctrHexLn < 16){
            ctrHex = ('0'.repeat(16-ctrHexLn)) + ctrHex;
            ctrBits = sjcl.codec.hex.toBits(ctrHex);
        }

        // 1. step, compute HMAC.
        var hs = hmac.mac(ctrBits);

        // 2. dynamic truncation. hs has 160 bits, take lower 4.
        // 0 <= offSet <= 15
        var offset = sjcl.bitArray.extract(hs, 156, 4) & 0xf;

        // Take low 31 bits from hs[offset]..hs[offset+3]
        // 3. Convert to a number.
        var snum = sjcl.bitArray.extract(hs, offset*8+1, 31);

        // 4. mod length. 31 bit => maximum length is 8. 9 makes no real sense.
        return snum % (Math.pow(10, length));
    },

    /**
     * Generates QR code link.
     * @param secret
     * @param options - additional options affecting QR code link generation.
     *      label: user name for HOTP auth,
     *      web: HOTP login gateway identification,
     *      issuer: HOTP account identification (e.g., enigmabridge, facebook, gmail, ....),
     *      ctr: HOTP counter,
     *      stripPadding: removes '=' from secret in the link, fixing problem with some HOTP authenticators.
     *
     * @returns {*}
     */
    hotpGetQrLink: function(secret, options){
        var defaults = {
            label: "EB",
            web: "enigmabridge.com",
            issuer: undefined,
            ctr: 0,
            digits: undefined,
            stripPadding: false
        };

        options = $.extend(defaults, options || {});
        var label = options && options.label;
        var web = options && options.web;
        var issuer = options && options.issuer;
        var ctr = options && options.ctr;
        var stripPadding = options && options.stripPadding;
        var digits = options && options.digits;

        // Construct the secret.
        var secretBits = eb.misc.inputToBits(secret);
        var secret32 = sjcl.codec.base32.fromBits(secretBits);
        if (stripPadding){
            secret32 = secret32.replace(/=/g,'');
        }

        return sprintf("otpauth://hotp/%s:%s?secret=%s%s%s%s",
            encodeURIComponent(label),
            encodeURIComponent(web),
            secret32,
            issuer !== undefined ? "&issuer="+encodeURIComponent(issuer) : "",
            ctr !== undefined ? "&counter="+ctr : "",
            digits !== undefined ? "&digits="+digits : ""
        );
    },

    /**
     * User context holder constructor.
     * Can be used by a client to hold all important data about user for HOTP.
     */
    hotpUserAuthCtxInfo: function(){

    },

    /**
     * HOTP general response constructor.
     * @extends eb.comm.response
     */
    hotpResponse: function(){

    },

    /**
     * General HOTP response parser constructor.
     */
    generalHotpParser: function(){

    },

    /**
     * New HOTPCTX request builder constructor.
     * @param options.
     *      userId:  user ID aditional entropy. By default 0000000000000001
     *      methods: flags for methods to include in context. USERAUTH_FLAG_HOTP, USERAUTH_FLAG_PASSWD.
     *      hotp: {digits}: hotp digits in the template. HOTP code length.
     *      passwd: {hash}: password hash used for authentication.
     */
    newHotpUserRequestBuilder: function(options){
        this.configure(options);
    },

    /**
     * New HOTPCTX response parser constructor.
     */
    newHotpUserResponseParser: function(){

    },

    /**
     * HOTP user authentication request builder constructor.
     */
    hotpUserAuthRequestBuilder: function(){

    },

    /**
     * HOTP user authentication response parser constructor.
     */
    hotpUserAuthResponseParser: function(){

    },

    /**
     * Generator of update auth context request constructor.
     */
    updateAuthContextRequestBuilder: function(options){
        this.configure(options);
    },

    /**
     * Auth context update response parser constuctor.
     */
    updateAuthContextResponseParser: function(options){

    },

    /**
     * Convenience function for building HOTP auth request.
     * @param userId hex coded user ID, 8B.
     * @param authCode hex coded auth code.
     * @param userCtx user context, bitArray.
     * @param method auth operation to perform, default=TLV_TYPE_HOTPCODE
     */
    getUserAuthRequest: function(userId, authCode, userCtx, method){
        var builder = new eb.comm.hotp.hotpUserAuthRequestBuilder(userId);
        return builder.build({
            userId: userId,
            authCode: authCode,
            userCtx: userCtx,
            authOperation: method || eb.comm.hotp.TLV_TYPE_HOTPCODE
        });
    },

    /**
     * General HOTP process data request constructor.
     * @param uo    UserObject to use for the call.
     * @abstract
     * @private
     */
    hotpRequest: function(uo){
        var av = eb.misc.absorbValue;
        av(this, uo, 'uo');
    },

    /**
     * Request for new HOTP CTX constructor.
     * @param options
     *      hotp:
     *      {
     *          uo    UserObject to use for the call.
     *          userId user ID to create context for.
     *          hotpLength number of digits
     *      }
     */
    newHotpUserRequest: function(options){
        options = options || {};
        this.configure(options);
    },

    /**
     * Request to authenticate HOTP user constructor.
     * @param options
     *      hotp:
     *      {
     *          uo UserObject to use for the call.
     *          userId
     *          userCtx
     *          hotpCode
     *          passwd
     *      }
     */
    authHotpUserRequest: function(options){
        options = options || {};
        this.configure(options);
    },

    /**
     * Request to update auth context constructor.
     * @param options
     *      hotp:
     *      {
     *          uo UserObject to use for the call.
     *          userId
     *          userCtx
     *          TODO: complete
     *      }
     */
    authContextUpdateRequest: function(options){
        options = options || {};
        this.configure(options);
    }

};

/**
 * HOTP user context holder.
 */
eb.comm.hotp.hotpUserAuthCtxInfo.inheritsFrom(eb.comm.base, {
    /**
     * User Auth context blob.
     * Server parameter.
     *
     * Authentication:
     *  - caller fills in with given user context. EB authenticates against this encrypted blob.
     *  - after authentication, this blob is updated by the server.
     *
     * New HOTPCTX():
     *  - caller leaves undefined.
     *  - server generates new user context. Server stores this value.
     */
    userCtx: undefined,

    /**
     * User ID to authenticate / create new HOTPCTX for.
     * Server parameter.
     */
    userId: undefined,

    /**
     * HOTP key - after new HOTPCTX(), server provides symmetric key for generating HOTP codes.
     * Used to generate HOTP on the client side. HOTP client is initialized with this value.
     * Client parameter.
     *
     * @output
     */
    hotpKey: undefined,

    /**
     * HOTP counter - counter value to generate HOTP codes on the client side.
     * Client parameter.
     *
     * Should be increased by each successful attempt on the client side.
     * By default is 0.
     */
    hotpCounter: 0,

    /**
     * HOTP code length. Length of the HOTP code in decimal digits.
     * Reasonable values: 6,7,8.
     */
    hotpCodeLength: undefined,

    /**
     * Auth password hash.
     */
    userPasswdHash: undefined
});

/**
 * HOTP EB response.
 */
eb.comm.hotp.hotpResponse.inheritsFrom(eb.comm.processDataResponse, {
    /**
     * bitArray with HOTP user context blob.
     */
    hotpUserCtx: undefined,

    /**
     * bitArray with UserID from the response.
     * Filled in after match from given user ID has been confirmed (if given).
     */
    hotpUserId: undefined,

    /**
     * bitArray with HOTP key returned in new HOTPCTX()
     */
    hotpKey: undefined,

    /**
     * Numeric result of the auth ProcessData call.
     */
    hotpStatus: undefined,

    /**
     * If true, whole HOTP response was parsed successfully.
     * In auth request it indicates context can be updated successfully.
     * Flag added by the response parser.
     * If false, exception was probably thrown during parsing.
     */
    hotpParsingSuccessful: false,

    /**
     * If true, server should update its user ctx for given user.
     * Flag added by the response parser.
     * If request fails from some reason, server still may need to update context - e.g., to
     * store fail counter.
     */
    hotpShouldUpdateCtx: false,

    toString: function(){
        return sprintf("HOTPResponse{hotpStatus=0x%04X, userId: %s, hotpKeyLen: %s, UserCtx: %s, parsingOk: %s, sub:{%s}}",
            this.hotpStatus,
            this.hotpUserId !== undefined ? sjcl.codec.hex.fromBits(eb.comm.hotp.userIdToBits(this.hotpUserId)) : 'undefined',
            this.hotpKey !== undefined ? sjcl.bitArray.bitLength(this.hotpKey) : 'undefined',
            this.hotpUserCtx !== undefined ? sjcl.codec.hex.fromBits(this.hotpUserCtx) : 'undefined',
            this.hotpParsingSuccessful,
            eb.comm.hotp.hotpResponse.superclass.toString.call(this)
        );
    }
});

/**
 * new HOTP user request builder.
 */
eb.comm.hotp.newHotpUserRequestBuilder.inheritsFrom(eb.comm.base, {
    defaults: {
        userId: undefined,
        methods: eb.comm.hotp.USERAUTH_FLAG_HOTP,
        hotp:{
            digits: eb.comm.hotp.HOTP_DIGITS_DEFAULT
        },
        passwd:{
            hash: undefined
        }
    },

    /**
     * Configures local object with the preferences.
     * @param options
     *      userId:  user ID aditional entropy. By default 0000000000000001
     *      methods: flags for methods to include in context. USERAUTH_FLAG_HOTP, USERAUTH_FLAG_PASSWD.
     *      hotp: {digits}: hotp digits in the template. HOTP code length.
     *      passwd: {hash}: password hash used for authentication.
     */
    configure: function(options){
        if (options) {
            this.defaults = $.extend(true, this.defaults, options || {});
        }
    },

    /**
     * New HOTCTX request builder.
     * @param options
     *      userId:  user ID aditional entropy. By default 0000000000000001
     *      methods: flags for methods to include in context. USERAUTH_FLAG_HOTP, USERAUTH_FLAG_PASSWD.
     *      hotp: {digits}: hotp digits in the template. HOTP code length.
     *      passwd: {hash}: password hash used for authentication.
     * @returns {*}
     */
    build: function(options){
        this.configure(options);

        var ba = sjcl.bitArray;
        var hex = sjcl.codec.hex;

        // Part 1 - auth context, encrypt with random password, template.
        var tpl = eb.comm.hotp.getCtxTemplate(this.defaults);
        var userAuthCtxPrepared = eb.comm.hotp.prepareUserContext(tpl);

        // Part 2 - auth context, unprotected
        var userAuthCtxUserID = ""; // extract from template
        var userAuthCtxUserIDBits = hex.toBits(userAuthCtxUserID);
        var userAuthCtxBits = ba.concat(userAuthCtxUserIDBits, tpl);

        var request = hex.toBits(sprintf("%02x", eb.comm.hotp.TLV_TYPE_USERAUTHCONTEXT));
        request = ba.concat(request, hex.toBits(sprintf("%04x", ba.bitLength(userAuthCtxPrepared)/8)));
        request = ba.concat(request, userAuthCtxPrepared);

        request = ba.concat(request, hex.toBits(sprintf("%02x", eb.comm.hotp.TLV_TYPE_NEWAUTHCONTEXT)));
        request = ba.concat(request, hex.toBits(sprintf("%04x", ba.bitLength(userAuthCtxBits)/8)));
        request = ba.concat(request, userAuthCtxBits);

        return request;
    }
});

/**
 * HOTP user auth request builder.
 */
eb.comm.hotp.hotpUserAuthRequestBuilder.inheritsFrom(eb.comm.base, {
    /**
     * Auth request builder.
     * @param options
     *      authCode: hex coded auth code. In case of HOTP, it should be the output of hotpCodeToHexCoded()
     *      userId: hex coded user ID, 8B.
     *      userCtx: user context, bitArray.
     *      authOperation: auth operation to perform, default=TLV_TYPE_HOTPCODE
     * @returns {*}
     */
    build: function(options){
        // ref: performTestUserAuthVerification
        var ba = sjcl.bitArray;
        var hex = sjcl.codec.hex;

        // Options.
        var defaults = {
            authCode: undefined,
            userId: undefined,
            userCtx: undefined,
            authOperation: eb.comm.hotp.TLV_TYPE_HOTPCODE
        };
        options = $.extend(defaults, options || {});
        var userId = options && options.userId;
        var authCode = options && options.authCode;
        var userCtx = options && options.userCtx;
        var authOperation = options && options.authOperation;
        if (!userId || !authCode || !userCtx || !authOperation){
            throw new eb.exception.invalid("User ID / HOTP / userCtx / authOperation code undefined");
        }

        var tlvOp, methods;
        if (authOperation == eb.comm.hotp.TLV_TYPE_HOTPCODE){
            tlvOp = eb.comm.hotp.TLV_TYPE_HOTPCODE;
            methods = eb.comm.hotp.USERAUTH_FLAG_HOTP;
        } else if (authOperation == eb.comm.hotp.TLV_TYPE_PASSWORDHASH){
            tlvOp = eb.comm.hotp.TLV_TYPE_PASSWORDHASH;
            methods = eb.comm.hotp.USERAUTH_FLAG_PASSWD;
        } else {
            throw new eb.exception.invalid("Unrecognized authentication method");
        }

        var verificationCode = eb.comm.hotp.userIdToHex(userId) + eb.misc.inputToHex(authCode);
        var verificationCodeBits = hex.toBits(verificationCode);
        var userCtxBits = eb.misc.inputToBits(userCtx);

        var request = hex.toBits(sprintf("%02x", eb.comm.hotp.TLV_TYPE_USERAUTHCONTEXT));
        request = ba.concat(request, hex.toBits(sprintf("%04x", ba.bitLength(userCtxBits)/8)));
        request = ba.concat(request, userCtxBits);

        request = ba.concat(request, hex.toBits(sprintf("%02x", tlvOp)));
        request = ba.concat(request, hex.toBits(sprintf("%04x", ba.bitLength(verificationCodeBits)/8)));
        request = ba.concat(request, verificationCodeBits);

        return request;
    }
});

/**
 * Generator of update auth context request
 */
eb.comm.hotp.updateAuthContextRequestBuilder.inheritsFrom(eb.comm.base, {
    defaults: {
        userId: undefined,
        userCtx: undefined,
        targetMethod: undefined,
        passwd: undefined
    },

    /**
     * Configures local object with the preferences.
     * @param options
     *      userId:  user ID aditional entropy. By default 0000000000000001
     *      userCtx: user context to update.
     *      targetMethod: method to update
     *      passwd: a new password hash to set in case of targetMethod == USERAUTH_FLAG_PASSWD
     */
    configure: function(options){
        if (options) {
            this.defaults = $.extend(true, this.defaults, options || {});
        }
    },

    build: function(options){
        // ref: performUpdateAuthCtx
        var ba = sjcl.bitArray;
        var hex = sjcl.codec.hex;
        this.configure(options);

        var userId = this.defaults.userId;
        var userCtx = this.defaults.userCtx;
        var passwd = this.defaults.passwd;
        var targetMethod = this.defaults.targetMethod;
        if (!userId || !userCtx || !targetMethod){
            throw new eb.exception.invalid("User ID / userCtx / targetMethod undefined");
        }
        if (targetMethod == eb.comm.hotp.USERAUTH_FLAG_PASSWD && passwd === undefined){
            throw new eb.exception.invalid("Password update method but password hash is undefined");
        }

        // Build update context request
        var userCtxBits = eb.misc.inputToBits(userCtx);
        var updateCtx = [];

        // User ID
        updateCtx = ba.concat(updateCtx, eb.comm.hotp.userIdToBits(userId));

        // Method #1 - HOTP
        if (targetMethod == eb.comm.hotp.USERAUTH_FLAG_HOTP){
            updateCtx = ba.concat(updateCtx, hex.toBits(sprintf("%02x0000", eb.comm.hotp.USER_AUTH_TYPE_HOTP)));
        }

        // Method #2 - Password
        if (targetMethod == eb.comm.hotp.USERAUTH_FLAG_PASSWD){
            var passwordBits = eb.misc.inputToBits(passwd);
            updateCtx = ba.concat(updateCtx, hex.toBits(sprintf("%02x%04x", eb.comm.hotp.USER_AUTH_TYPE_PASSWD, ba.bitLength(passwordBits)/8)));
            updateCtx = ba.concat(updateCtx, passwordBits);
        }

        // Method #3 - Global attempts
        if (targetMethod == eb.comm.hotp.USERAUTH_FLAG_GLOBALTRIES){
            updateCtx = ba.concat(updateCtx, hex.toBits(sprintf("%02x0000", eb.comm.hotp.USER_AUTH_TYPE_GLOBALTRIES)));
        }

        // Request itself.
        var request = [];
        request = ba.concat(request, hex.toBits(sprintf("%02x", eb.comm.hotp.TLV_TYPE_USERAUTHCONTEXT)));
        request = ba.concat(request, hex.toBits(sprintf("%04x", ba.bitLength(userCtxBits)/8)));
        request = ba.concat(request, userCtxBits);

        request = ba.concat(request, hex.toBits(sprintf("%02x", eb.comm.hotp.TLV_TYPE_UPDATEAUTHCONTEXT)));
        request = ba.concat(request, hex.toBits(sprintf("%04x", ba.bitLength(updateCtx)/8)));
        request = ba.concat(request, updateCtx);

        return request;
    }
});

/**
 * General HOTP response parser, base class.
 */
eb.comm.hotp.generalHotpParser.inheritsFrom(eb.comm.base, {
    response: undefined,

    /**
     * General parsing routine for HOTP responses.
     *
     * @param data
     * @param resp response to fill in with parsed data, takes preference to options.response
     * @param options
     *      tlvOp: HOTP operation to expect
     *      methods: auth methods to parse from the response (default=0)
     *      bIsLocalCtxUpdate: if set to YES, hotp key is updated in ctx (default=YES)
     *      userId: user ID to match against response user ID (default=undefined, no matching)
     *      response: response to fill in with parsed data. (default=undefined, new one is created)
     *
     * @returns {*|eb.comm.response|null|request|number|Object}
     */
    parse: function(data, resp, options){
        // ref: processUserAuthResponse
        var ba = sjcl.bitArray;
        var offset = 0;

        // Options.
        var defaults = {
            tlvOp: undefined,
            methods: 0x0,
            bIsLocalCtxUpdate: true,
            userId: undefined,
            response: undefined
        };

        options = $.extend(defaults, options || {});
        var tlvOp = options && options.tlvOp;
        var methods = options && options.methods;
        var bIsLocalCtxUpdate = options && options.bIsLocalCtxUpdate;
        var givenUserId = options && options.userId;
        var response = resp || (options && options.response);
        response = response || new eb.comm.hotp.hotpResponse();
        if (tlvOp === undefined){
            throw new eb.exception.corrupt("Main TLV operation undefined");
        }

        this.response = response;
        response.hotpStatus = 0x0;
        response.hotpParsingSuccessful = false;
        response.hotpShouldUpdateCtx = false;

        // Check for the plainData length = 0 was here, but protected data does not contain plain data,
        // it was moved to a different field in the response message so we don't check it here,
        // while original code in processUserAuthResponse does.

        // Check main tag value.
        var tag = ba.extract(data, offset, 8);
        offset += 8;
        if (tag != eb.comm.hotp.TLV_TYPE_USERAUTHCONTEXT){
            response.hotpStatus = eb.comm.status.SW_INVALID_TLV_FORMAT;
            throw new eb.exception.corrupt("Unrecognized TLV tag");
        }

        // Extract user context.
        var userCtxLen = ba.extract(data, offset, 16);
        offset += 16;
        response.hotpUserCtx = ba.bitSlice(data, offset, offset+userCtxLen*8);
        offset += userCtxLen*8;

        // Main TLV op type
        var msgTlv = ba.extract(data, offset, 8);
        offset += 8;
        if (msgTlv != tlvOp){
            response.hotpStatus = eb.comm.status.SW_INVALID_TLV_FORMAT;
            throw new eb.exception.corrupt("Main TLV tag does not match");
        }

        // Response
        var responseLen = ba.extract(data, offset, 16);
        offset += 16;

        // User ID
        var requestUserId = ba.bitSlice(data, offset, offset+eb.comm.hotp.USERAUTHCTX_MAIN_USERID_LENGTH*8);
        offset += eb.comm.hotp.USERAUTHCTX_MAIN_USERID_LENGTH*8;

        // Compare set user id.
        if (givenUserId){
            if (!ba.equal(eb.comm.hotp.userIdToBits(givenUserId), requestUserId)){
                response.hotpStatus = eb.comm.status.SW_AUTH_MISMATCH_USER_ID;
                throw new eb.exception.corrupt("User ID mismatch");
            }
        }
        response.hotpUserId = requestUserId;

        // Methods
        var methodTag, dataReturnLen;

        // Method #1
        if ((methods & eb.comm.hotp.USERAUTH_FLAG_HOTP) > 0){
            methodTag = ba.extract(data, offset, 8);
            offset += 8;
            if (methodTag != eb.comm.hotp.USER_AUTH_TYPE_HOTP){
                response.hotpStatus = eb.comm.status.SW_AUTHMETHOD_UNKNOWN;
                throw new eb.exception.corrupt("Invalid method tag");
            }

            dataReturnLen = ba.extract(data, offset, 16);
            offset += 16;
            if (bIsLocalCtxUpdate){
                response.hotpKey = ba.bitSlice(data, offset, offset+dataReturnLen*8);

            } else if (dataReturnLen != 0) {
                throw new eb.exception.corrupt("Should not contain data");
            }

            offset += dataReturnLen*8;
        }

        // Method #2
        if ((methods & eb.comm.hotp.USERAUTH_FLAG_PASSWD) > 0){
            methodTag = ba.extract(data, offset, 8);
            offset += 8;
            if (methodTag != eb.comm.hotp.USER_AUTH_TYPE_PASSWD){
                response.hotpStatus = eb.comm.status.SW_AUTHMETHOD_UNKNOWN;
                throw new eb.exception.corrupt("Invalid method tag");
            }

            dataReturnLen = ba.extract(data, offset, 16);
            offset += 16;
            if (dataReturnLen != 0) {
                throw new eb.exception.corrupt("Should not contain data");
            }
        }

        // Method #3
        if ((methods & eb.comm.hotp.USERAUTH_FLAG_GLOBALTRIES) > 0){
            methodTag = ba.extract(data, offset, 8);
            offset += 8;
            if (methodTag != eb.comm.hotp.USER_AUTH_TYPE_GLOBALTRIES){
                response.hotpStatus = eb.comm.status.SW_AUTHMETHOD_UNKNOWN;
                throw new eb.exception.corrupt("Invalid method tag");
            }

            dataReturnLen = ba.extract(data, offset, 16);
            offset += 16;
            if (dataReturnLen != 0) {
                throw new eb.exception.corrupt("Should not contain data");
            }
        }

        if ((offset + 16) != ba.bitLength(data)){
            throw new eb.exception.corrupt("Data length invalid");
        }

        response.hotpStatus = ba.extract(data, offset, 16);
        offset += 16;

        response.hotpShouldUpdateCtx = true;
        response.hotpParsingSuccessful = true;
        return response;
    }
});

/**
 * new HOTP user response parser.
 */
eb.comm.hotp.newHotpUserResponseParser.inheritsFrom(eb.comm.hotp.generalHotpParser, {
    parse: function(data, resp, options){
        options = options || {};
        options.tlvOp = eb.comm.hotp.TLV_TYPE_NEWAUTHCONTEXT;
        options.bIsLocalCtxUpdate = true;
        options.userId = undefined;
        options.methods = options.methods || eb.comm.hotp.USERAUTH_FLAG_HOTP;

        return eb.comm.hotp.newHotpUserResponseParser.superclass.parse.call(this, data, resp, options);
    }
});

/**
 * HOTP user auth response parser.
 */
eb.comm.hotp.hotpUserAuthResponseParser.inheritsFrom(eb.comm.hotp.generalHotpParser, {
    parse: function(data, resp, options){
        options = options || {};
        options.bIsLocalCtxUpdate = false;
        options.tlvOp = options.tlvOp || eb.comm.hotp.TLV_TYPE_HOTPCODE;
        options.methods = options.methods || eb.comm.hotp.USERAUTH_FLAG_HOTP;

        return eb.comm.hotp.hotpUserAuthResponseParser.superclass.parse.call(this, data, resp, options);
    }
});

/**
 * HOTP user auth response parser.
 */
eb.comm.hotp.updateAuthContextResponseParser.inheritsFrom(eb.comm.hotp.generalHotpParser, {
    parse: function(data, resp, options){
        options = options || {};
        options.bIsLocalCtxUpdate = true;
        options.tlvOp = eb.comm.hotp.TLV_TYPE_UPDATEAUTHCONTEXT;

        return eb.comm.hotp.updateAuthContextResponseParser.superclass.parse.call(this, data, resp, options);
    }
});

/**
 * HOTP request, base class.
 */
eb.comm.hotp.hotpRequest.inheritsFrom(eb.comm.processData, {
    /**
     * UserObject to use for the call.
     * TODO: once ready, move to processData request as comm keys will be stored there.
     */
    uo: undefined,

    /**
     * User ID to use.
     */
    userId: undefined,

    // Done & fail callback hooking.
    doneCallbackOrig: function(response, requestObj, data){},
    failCallbackOrig: function(failType, data){},

    done: function(x){
        this.doneCallbackOrig = x;
        eb.comm.hotp.hotpRequest.superclass.done.call(this, this.subDone);
        return this;
    },

    fail: function(x){
        this.failCallbackOrig = x;
        eb.comm.hotp.hotpRequest.superclass.fail.call(this, this.subFail);
        return this;
    },

    /**
     * Process configuration from the config object.
     * @param configObject object with the configuration.
     */
    configure: function(configObject){
        if (!configObject){
            this._log("Invalid config object");
            return;
        }

        // Configure with parent.
        eb.comm.hotp.hotpRequest.superclass.configure.call(this, configObject);

        // Configure this.
        if ('hotp' in configObject){
            this.configureHotp(configObject.hotp);
        }
    },

    /**
     * Configuration helper for HOTP data.
     * Called from configure() and build().
     * @param hotpData
     */
    configureHotp: function(hotpData){
        var ak = eb.misc.absorbKey;
        ak(this, hotpData, "uo");
        ak(this, hotpData, "userId");
    },

    /**
     * Response object is HOTP response.
     * After data unwrap, it will be processed further.
     *
     * @returns {eb.comm.hotp.hotpResponse}
     */
    getResponseObject: function(){
        return new eb.comm.hotp.hotpResponse();
    },

    /**
     * Called when underlying parser finished processing. Post processing here.
     *
     * @param response
     * @param requestObj
     * @param data
     * @private
     */
    subDone: function(response, requestObj, data){
        if (this.doneCallbackOrig){
            this.doneCallbackOrig(response, requestObj, data);
        }
    },

    /**
     * Called when underlying api request failed. Post processing here.
     * @param failType
     * @param data
     */
    subFail: function(failType, data){
        if (this.failCallbackOrig){
            this.failCallbackOrig(failType, data);
        }
    }
});

/**
 * New HOTP user request.
 * TODO: For configuration, new configuration builder can be implemented.
 */
eb.comm.hotp.newHotpUserRequest.inheritsFrom(eb.comm.hotp.hotpRequest, {
    /**
     * Configuration object given in construction / configure / build phases
     */
    authConfig: $.extend(true, {}, eb.comm.hotp.newHotpUserRequestBuilder.defaults),

    /**
     * Process HOTP configuration.
     * @param hotpObject hotp object
     */
    configureHotp: function(hotpObject){
        // Configure with parent.
        eb.comm.hotp.newHotpUserRequest.superclass.configureHotp.call(this, hotpObject);

        // authConfig
        this.authConfig = $.extend(true, this.authConfig, hotpObject || {});
    },

    /**
     * Initializes state and builds request
     */
    build: function(configObject){
        this._log("Building request body");
        if (configObject && 'hotp' in configObject){
            this.configureHotp(configObject.hotp);
        }

        // Build the new HOTPCTX() request.
        var builder = new eb.comm.hotp.newHotpUserRequestBuilder(this.authConfig);
        var upperRequest = builder.build();

        //var upperRequest = eb.comm.hotp.getNewUserRequest(this.userId, this.hotpLength);
        this._log("New HOTPCTX request: " + sjcl.codec.hex.fromBits(upperRequest));

        // Request data to lower process data builder.
        eb.comm.hotp.newHotpUserRequest.superclass.build.call(this, [], upperRequest);
    },

    /**
     * Process result, unwrapped by the underlying response parser.
     * @param response
     * @param requestObj
     * @param data
     */
    subDone: function(response, requestObj, data){
        var parser = new eb.comm.hotp.newHotpUserResponseParser(this.authConfig);
        var options = {};
        if (this.authConfig && this.authConfig.methods){
            options.methods = this.authConfig.methods;
        }

        try {
            this.response = response = parser.parse(response.protectedData, response, options);
            if (response.hotpStatus == eb.comm.status.SW_STAT_OK) {
                if (this.doneCallbackOrig) {
                    this.doneCallbackOrig(response, requestObj, data);
                }
                return;
            }
        } catch(e){
            data.hotpException = e;
        }

        if (this.failCallbackOrig){
            this.failCallbackOrig(eb.comm.status.PDATA_FAIL_RESPONSE_FAILED, data);
        }
    }
});

/**
 * HOTP user auth request.
 */
eb.comm.hotp.authHotpUserRequest.inheritsFrom(eb.comm.hotp.hotpRequest, {
    userCtx: undefined,
    hotpCode: undefined,
    hotpLength: eb.comm.hotp.HOTP_DIGITS_DEFAULT,
    passwd: undefined,

    // Private variables, request configures response parser.
    authMethod: undefined,
    authFlag: undefined,

    /**
     * Process HOTP configuration.
     * @param hotpObject hotp object
     */
    configureHotp: function(hotpObject){
        // Configure with parent.
        eb.comm.hotp.authHotpUserRequest.superclass.configureHotp.call(this, hotpObject);

        // Configure this.
        var ak = eb.misc.absorbKey;
        ak(this, hotpObject, "userCtx");
        ak(this, hotpObject, "hotpCode");
        ak(this, hotpObject, "hotpLength");
        ak(this, hotpObject, "passwd");
    },

    /**
     * Initializes state and builds request
     */
    build: function(configObject){
        this._log("Building request body");
        if (configObject && 'hotp' in configObject){
            this.configureHotp(configObject.hotp);
        }

        // Current limitation - only one method at a time
        if (this.passwd && this.passwd.length > 0 && this.hotpCode){
            this._log("Multiple authentication methods were required.");
            throw new eb.exception.invalid("Authentication supports only one authentication method at a time");
        }

        var authCode;
        if (this.passwd && this.passwd.length > 0){
            authCode = this.passwd;
            this.authMethod = eb.comm.hotp.TLV_TYPE_PASSWORDHASH;
            this.authFlag = eb.comm.hotp.USERAUTH_FLAG_PASSWD;
            this._log("Using Password authentication");

        } else if (this.hotpCode) {
            authCode = eb.comm.hotp.hotpCodeToHexCoded(this.hotpCode, this.hotpLength);
            this.authMethod = eb.comm.hotp.TLV_TYPE_HOTPCODE;
            this.authFlag = eb.comm.hotp.USERAUTH_FLAG_HOTP;
            this._log("Using HOTP authentication");

        } else {
            throw new eb.exception.invalid("No authentication data given");
        }

        // Build the auth request.
        var upperRequest = eb.comm.hotp.getUserAuthRequest(
            this.userId,
            authCode,
            this.userCtx,
            this.authMethod);

        this._log("HOTP Auth request: " + sjcl.codec.hex.fromBits(upperRequest));

        // Request data to lower process data builder.
        eb.comm.hotp.authHotpUserRequest.superclass.build.call(this, [], upperRequest);
    },

    /**
     * Process result, unwrapped by the underlying response parser.
     * @param response
     * @param requestObj
     * @param data
     */
    subDone: function(response, requestObj, data){
        var parser = new eb.comm.hotp.hotpUserAuthResponseParser();
        var options = {
            userId: this.userId,
            tlvOp:  this.authMethod,
            methods:this.authFlag
        };

        try {
            this.response = response = parser.parse(response.protectedData, response, options);
            if (response.hotpStatus == eb.comm.status.SW_STAT_OK) {
                if (this.doneCallbackOrig) {
                    this.doneCallbackOrig(response, requestObj, data);
                }
                return;
            }

        } catch(e){
            data.hotpException = e;
        }

        if (this.failCallbackOrig){
            data.response = this.response;
            this.failCallbackOrig(eb.comm.status.PDATA_FAIL_RESPONSE_FAILED, data);
        }
    }
});

/**
 * Request to update auth context.
 */
eb.comm.hotp.authContextUpdateRequest.inheritsFrom(eb.comm.hotp.hotpRequest, {
    userCtx: undefined,
    passwd: undefined,
    method: undefined,

    /**
     * Process HOTP configuration.
     * @param hotpObject hotp object
     */
    configureHotp: function(hotpObject){
        // Configure with parent.
        eb.comm.hotp.authContextUpdateRequest.superclass.configureHotp.call(this, hotpObject);

        // Configure this.
        var ak = eb.misc.absorbKey;
        ak(this, hotpObject, "userCtx");
        ak(this, hotpObject, "method");
        ak(this, hotpObject, "passwd");
    },

    /**
     * Initializes state and builds request
     */
    build: function(configObject){
        this._log("Building request body");
        if (configObject && 'hotp' in configObject){
            this.configureHotp(configObject.hotp);
        }

        if (this.method === undefined){
            throw new eb.exception.invalid("Update method not defined");
        }
        if (this.userId === undefined || this.userCtx === undefined){
            throw new eb.exception.invalid("UserID / UserCtx not defined");
        }
        if (this.method === eb.comm.hotp.USERAUTH_FLAG_PASSWD && this.passwd === undefined){
            throw new eb.exception.invalid("Update method is password but password is undefined");
        }

        // Build the auth request.
        var reqBuilder = new eb.comm.hotp.updateAuthContextRequestBuilder({
            userId: this.userId,
            userCtx: this.userCtx,
            targetMethod: this.method,
            passwd: this.passwd
        });

        var upperRequest = reqBuilder.build();

        this._log("Auth context update request: " + sjcl.codec.hex.fromBits(upperRequest));

        // Request data to lower process data builder.
        eb.comm.hotp.authContextUpdateRequest.superclass.build.call(this, [], upperRequest);
    },

    /**
     * Process result, unwrapped by the underlying response parser.
     * @param response
     * @param requestObj
     * @param data
     */
    subDone: function(response, requestObj, data){
        var parser = new eb.comm.hotp.updateAuthContextResponseParser();
        var options = {
            userId: this.userId,
            methods:this.method
        };

        try {
            this.response = response = parser.parse(response.protectedData, response, options);
            if (response.hotpStatus == eb.comm.status.SW_STAT_OK) {
                if (this.doneCallbackOrig) {
                    this.doneCallbackOrig(response, requestObj, data);
                }
                return;
            }

        } catch(e){
            data.hotpException = e;
        }

        if (this.failCallbackOrig){
            data.response = this.response;
            this.failCallbackOrig(eb.comm.status.PDATA_FAIL_RESPONSE_FAILED, data);
        }
    }
});

// <jsbn>
// Copyright (c) 2005  Tom Wu
// All Rights Reserved.
// See "LICENSE" for details.

// Basic JavaScript BN library - subset useful for RSA encryption.
(function (factory) {
    if(typeof DO_NOT_EXPORT_BIGINTEGER === 'undefined') {
        if('object' === typeof exports) {
            factory(exports);
        } else if ('function' === typeof define && define.amd) {
            define(function () {
                var module = {};
                factory(module);
                return module;
            });
        } else {
            factory(eb.math = {});
        }
    } else {
        factory(eb.math = {});
    }
}(function(BigIntegerModule)
{
    // Basic JavaScript BN library - subset useful for RSA encryption.
    // Bits per digit
    var dbits;

    // JavaScript engine analysis
    var canary = 0xdeadbeefcafe;
    var j_lm = ((canary&0xffffff)==0xefcafe);

    // (public) Constructor
    function BigInteger(a,b,c) {
        if(a != null)
            if("number" == typeof a) this.fromNumber(a,b,c);
            else if(b == null && "string" != typeof a) this.fromString(a,256);
            else this.fromString(a,b);
    }
    BigIntegerModule.BigInteger = BigInteger;

    // return new, unset BigInteger
    function nbi() { return new BigInteger(null); }

    // am: Compute w_j += (x*this_i), propagate carries,
    // c is initial carry, returns final carry.
    // c < 3*dvalue, x < 2*dvalue, this_i < dvalue
    // We need to select the fastest one that works in this environment.

    // am1: use a single mult and divide to get the high bits,
    // max digit bits should be 26 because
    // max internal value = 2*dvalue^2-2*dvalue (< 2^53)
    function am1(i,x,w,j,c,n) {
        while(--n >= 0) {
            var v = x*this[i++]+w[j]+c;
            c = Math.floor(v/0x4000000);
            w[j++] = v&0x3ffffff;
        }
        return c;
    }
    // am2 avoids a big mult-and-extract completely.
    // Max digit bits should be <= 30 because we do bitwise ops
    // on values up to 2*hdvalue^2-hdvalue-1 (< 2^31)
    function am2(i,x,w,j,c,n) {
        var xl = x&0x7fff, xh = x>>15;
        while(--n >= 0) {
            var l = this[i]&0x7fff;
            var h = this[i++]>>15;
            var m = xh*l+h*xl;
            l = xl*l+((m&0x7fff)<<15)+w[j]+(c&0x3fffffff);
            c = (l>>>30)+(m>>>15)+xh*h+(c>>>30);
            w[j++] = l&0x3fffffff;
        }
        return c;
    }
    // Alternately, set max digit bits to 28 since some
    // browsers slow down when dealing with 32-bit numbers.
    function am3(i,x,w,j,c,n) {
        var xl = x&0x3fff, xh = x>>14;
        while(--n >= 0) {
            var l = this[i]&0x3fff;
            var h = this[i++]>>14;
            var m = xh*l+h*xl;
            l = xl*l+((m&0x3fff)<<14)+w[j]+c;
            c = (l>>28)+(m>>14)+xh*h;
            w[j++] = l&0xfffffff;
        }
        return c;
    }
    if(j_lm && (navigator.appName == "Microsoft Internet Explorer")) {
        BigInteger.prototype.am = am2;
        dbits = 30;
    }
    else if(j_lm && (navigator.appName != "Netscape")) {
        BigInteger.prototype.am = am1;
        dbits = 26;
    }
    else { // Mozilla/Netscape seems to prefer am3
        BigInteger.prototype.am = am3;
        dbits = 28;
    }

    BigInteger.prototype.DB = dbits;
    BigInteger.prototype.DM = ((1<<dbits)-1);
    BigInteger.prototype.DV = (1<<dbits);

    var BI_FP = 52;
    BigInteger.prototype.FV = Math.pow(2,BI_FP);
    BigInteger.prototype.F1 = BI_FP-dbits;
    BigInteger.prototype.F2 = 2*dbits-BI_FP;

    // Digit conversions
    var BI_RM = "0123456789abcdefghijklmnopqrstuvwxyz";
    var BI_RC = new Array();
    var rr,vv;
    rr = "0".charCodeAt(0);
    for(vv = 0; vv <= 9; ++vv) BI_RC[rr++] = vv;
    rr = "a".charCodeAt(0);
    for(vv = 10; vv < 36; ++vv) BI_RC[rr++] = vv;
    rr = "A".charCodeAt(0);
    for(vv = 10; vv < 36; ++vv) BI_RC[rr++] = vv;

    function int2char(n) { return BI_RM.charAt(n); }
    function intAt(s,i) {
        var c = BI_RC[s.charCodeAt(i)];
        return (c==null)?-1:c;
    }

    // (protected) copy this to r
    function bnpCopyTo(r) {
        for(var i = this.t-1; i >= 0; --i) r[i] = this[i];
        r.t = this.t;
        r.s = this.s;
    }

    // (protected) set from integer value x, -DV <= x < DV
    function bnpFromInt(x) {
        this.t = 1;
        this.s = (x<0)?-1:0;
        if(x > 0) this[0] = x;
        else if(x < -1) this[0] = x+this.DV;
        else this.t = 0;
    }

    // return bigint initialized to value
    function nbv(i) { var r = nbi(); r.fromInt(i); return r; }

    // (protected) set from string and radix
    function bnpFromString(s,b) {
        var k;
        if(b == 16) k = 4;
        else if(b == 8) k = 3;
        else if(b == 256) k = 8; // byte array
        else if(b == 2) k = 1;
        else if(b == 32) k = 5;
        else if(b == 4) k = 2;
        else { this.fromRadix(s,b); return; }
        this.t = 0;
        this.s = 0;
        var i = s.length, mi = false, sh = 0;
        while(--i >= 0) {
            var x = (k==8)?s[i]&0xff:intAt(s,i);
            if(x < 0) {
                if(s.charAt(i) == "-") mi = true;
                continue;
            }
            mi = false;
            if(sh == 0)
                this[this.t++] = x;
            else if(sh+k > this.DB) {
                this[this.t-1] |= (x&((1<<(this.DB-sh))-1))<<sh;
                this[this.t++] = (x>>(this.DB-sh));
            }
            else
                this[this.t-1] |= x<<sh;
            sh += k;
            if(sh >= this.DB) sh -= this.DB;
        }
        if(k == 8 && (s[0]&0x80) != 0) {
            this.s = -1;
            if(sh > 0) this[this.t-1] |= ((1<<(this.DB-sh))-1)<<sh;
        }
        this.clamp();
        if(mi) BigInteger.ZERO.subTo(this,this);
    }

    // (protected) clamp off excess high words
    function bnpClamp() {
        var c = this.s&this.DM;
        while(this.t > 0 && this[this.t-1] == c) --this.t;
    }

    // (public) return string representation in given radix
    function bnToString(b) {
        if(this.s < 0) return "-"+this.negate().toString(b);
        var k;
        if(b == 16) k = 4;
        else if(b == 8) k = 3;
        else if(b == 2) k = 1;
        else if(b == 32) k = 5;
        else if(b == 4) k = 2;
        else return this.toRadix(b);
        var km = (1<<k)-1, d, m = false, r = "", i = this.t;
        var p = this.DB-(i*this.DB)%k;
        if(i-- > 0) {
            if(p < this.DB && (d = this[i]>>p) > 0) { m = true; r = int2char(d); }
            while(i >= 0) {
                if(p < k) {
                    d = (this[i]&((1<<p)-1))<<(k-p);
                    d |= this[--i]>>(p+=this.DB-k);
                }
                else {
                    d = (this[i]>>(p-=k))&km;
                    if(p <= 0) { p += this.DB; --i; }
                }
                if(d > 0) m = true;
                if(m) r += int2char(d);
            }
        }
        return m?r:"0";
    }

    // (public) -this
    function bnNegate() { var r = nbi(); BigInteger.ZERO.subTo(this,r); return r; }

    // (public) |this|
    function bnAbs() { return (this.s<0)?this.negate():this; }

    // (public) return + if this > a, - if this < a, 0 if equal
    function bnCompareTo(a) {
        var r = this.s-a.s;
        if(r != 0) return r;
        var i = this.t;
        r = i-a.t;
        if(r != 0) return (this.s<0)?-r:r;
        while(--i >= 0) if((r=this[i]-a[i]) != 0) return r;
        return 0;
    }

    // returns bit length of the integer x
    function nbits(x) {
        var r = 1, t;
        if((t=x>>>16) != 0) { x = t; r += 16; }
        if((t=x>>8) != 0) { x = t; r += 8; }
        if((t=x>>4) != 0) { x = t; r += 4; }
        if((t=x>>2) != 0) { x = t; r += 2; }
        if((t=x>>1) != 0) { x = t; r += 1; }
        return r;
    }

    // (public) return the number of bits in "this"
    function bnBitLength() {
        if(this.t <= 0) return 0;
        return this.DB*(this.t-1)+nbits(this[this.t-1]^(this.s&this.DM));
    }

    // (protected) r = this << n*DB
    function bnpDLShiftTo(n,r) {
        var i;
        for(i = this.t-1; i >= 0; --i) r[i+n] = this[i];
        for(i = n-1; i >= 0; --i) r[i] = 0;
        r.t = this.t+n;
        r.s = this.s;
    }

    // (protected) r = this >> n*DB
    function bnpDRShiftTo(n,r) {
        for(var i = n; i < this.t; ++i) r[i-n] = this[i];
        r.t = Math.max(this.t-n,0);
        r.s = this.s;
    }

    // (protected) r = this << n
    function bnpLShiftTo(n,r) {
        var bs = n%this.DB;
        var cbs = this.DB-bs;
        var bm = (1<<cbs)-1;
        var ds = Math.floor(n/this.DB), c = (this.s<<bs)&this.DM, i;
        for(i = this.t-1; i >= 0; --i) {
            r[i+ds+1] = (this[i]>>cbs)|c;
            c = (this[i]&bm)<<bs;
        }
        for(i = ds-1; i >= 0; --i) r[i] = 0;
        r[ds] = c;
        r.t = this.t+ds+1;
        r.s = this.s;
        r.clamp();
    }

    // (protected) r = this >> n
    function bnpRShiftTo(n,r) {
        r.s = this.s;
        var ds = Math.floor(n/this.DB);
        if(ds >= this.t) { r.t = 0; return; }
        var bs = n%this.DB;
        var cbs = this.DB-bs;
        var bm = (1<<bs)-1;
        r[0] = this[ds]>>bs;
        for(var i = ds+1; i < this.t; ++i) {
            r[i-ds-1] |= (this[i]&bm)<<cbs;
            r[i-ds] = this[i]>>bs;
        }
        if(bs > 0) r[this.t-ds-1] |= (this.s&bm)<<cbs;
        r.t = this.t-ds;
        r.clamp();
    }

    // (protected) r = this - a
    function bnpSubTo(a,r) {
        var i = 0, c = 0, m = Math.min(a.t,this.t);
        while(i < m) {
            c += this[i]-a[i];
            r[i++] = c&this.DM;
            c >>= this.DB;
        }
        if(a.t < this.t) {
            c -= a.s;
            while(i < this.t) {
                c += this[i];
                r[i++] = c&this.DM;
                c >>= this.DB;
            }
            c += this.s;
        }
        else {
            c += this.s;
            while(i < a.t) {
                c -= a[i];
                r[i++] = c&this.DM;
                c >>= this.DB;
            }
            c -= a.s;
        }
        r.s = (c<0)?-1:0;
        if(c < -1) r[i++] = this.DV+c;
        else if(c > 0) r[i++] = c;
        r.t = i;
        r.clamp();
    }

    // (protected) r = this * a, r != this,a (HAC 14.12)
    // "this" should be the larger one if appropriate.
    function bnpMultiplyTo(a,r) {
        var x = this.abs(), y = a.abs();
        var i = x.t;
        r.t = i+y.t;
        while(--i >= 0) r[i] = 0;
        for(i = 0; i < y.t; ++i) r[i+x.t] = x.am(0,y[i],r,i,0,x.t);
        r.s = 0;
        r.clamp();
        if(this.s != a.s) BigInteger.ZERO.subTo(r,r);
    }

    // (protected) r = this^2, r != this (HAC 14.16)
    function bnpSquareTo(r) {
        var x = this.abs();
        var i = r.t = 2*x.t;
        while(--i >= 0) r[i] = 0;
        for(i = 0; i < x.t-1; ++i) {
            var c = x.am(i,x[i],r,2*i,0,1);
            if((r[i+x.t]+=x.am(i+1,2*x[i],r,2*i+1,c,x.t-i-1)) >= x.DV) {
                r[i+x.t] -= x.DV;
                r[i+x.t+1] = 1;
            }
        }
        if(r.t > 0) r[r.t-1] += x.am(i,x[i],r,2*i,0,1);
        r.s = 0;
        r.clamp();
    }

    // (protected) divide this by m, quotient and remainder to q, r (HAC 14.20)
    // r != q, this != m.  q or r may be null.
    function bnpDivRemTo(m,q,r) {
        var pm = m.abs();
        if(pm.t <= 0) return;
        var pt = this.abs();
        if(pt.t < pm.t) {
            if(q != null) q.fromInt(0);
            if(r != null) this.copyTo(r);
            return;
        }
        if(r == null) r = nbi();
        var y = nbi(), ts = this.s, ms = m.s;
        var nsh = this.DB-nbits(pm[pm.t-1]);	// normalize modulus
        if(nsh > 0) { pm.lShiftTo(nsh,y); pt.lShiftTo(nsh,r); }
        else { pm.copyTo(y); pt.copyTo(r); }
        var ys = y.t;
        var y0 = y[ys-1];
        if(y0 == 0) return;
        var yt = y0*(1<<this.F1)+((ys>1)?y[ys-2]>>this.F2:0);
        var d1 = this.FV/yt, d2 = (1<<this.F1)/yt, e = 1<<this.F2;
        var i = r.t, j = i-ys, t = (q==null)?nbi():q;
        y.dlShiftTo(j,t);
        if(r.compareTo(t) >= 0) {
            r[r.t++] = 1;
            r.subTo(t,r);
        }
        BigInteger.ONE.dlShiftTo(ys,t);
        t.subTo(y,y);	// "negative" y so we can replace sub with am later
        while(y.t < ys) y[y.t++] = 0;
        while(--j >= 0) {
            // Estimate quotient digit
            var qd = (r[--i]==y0)?this.DM:Math.floor(r[i]*d1+(r[i-1]+e)*d2);
            if((r[i]+=y.am(0,qd,r,j,0,ys)) < qd) {	// Try it out
                y.dlShiftTo(j,t);
                r.subTo(t,r);
                while(r[i] < --qd) r.subTo(t,r);
            }
        }
        if(q != null) {
            r.drShiftTo(ys,q);
            if(ts != ms) BigInteger.ZERO.subTo(q,q);
        }
        r.t = ys;
        r.clamp();
        if(nsh > 0) r.rShiftTo(nsh,r);	// Denormalize remainder
        if(ts < 0) BigInteger.ZERO.subTo(r,r);
    }

    // (public) this mod a
    function bnMod(a) {
        var r = nbi();
        this.abs().divRemTo(a,null,r);
        if(this.s < 0 && r.compareTo(BigInteger.ZERO) > 0) a.subTo(r,r);
        return r;
    }

    // Modular reduction using "classic" algorithm
    function Classic(m) { this.m = m; }
    function cConvert(x) {
        if(x.s < 0 || x.compareTo(this.m) >= 0) return x.mod(this.m);
        else return x;
    }
    function cRevert(x) { return x; }
    function cReduce(x) { x.divRemTo(this.m,null,x); }
    function cMulTo(x,y,r) { x.multiplyTo(y,r); this.reduce(r); }
    function cSqrTo(x,r) { x.squareTo(r); this.reduce(r); }

    Classic.prototype.convert = cConvert;
    Classic.prototype.revert = cRevert;
    Classic.prototype.reduce = cReduce;
    Classic.prototype.mulTo = cMulTo;
    Classic.prototype.sqrTo = cSqrTo;

    // (protected) return "-1/this % 2^DB"; useful for Mont. reduction
    // justification:
    //         xy == 1 (mod m)
    //         xy =  1+km
    //   xy(2-xy) = (1+km)(1-km)
    // x[y(2-xy)] = 1-k^2m^2
    // x[y(2-xy)] == 1 (mod m^2)
    // if y is 1/x mod m, then y(2-xy) is 1/x mod m^2
    // should reduce x and y(2-xy) by m^2 at each step to keep size bounded.
    // JS multiply "overflows" differently from C/C++, so care is needed here.
    function bnpInvDigit() {
        if(this.t < 1) return 0;
        var x = this[0];
        if((x&1) == 0) return 0;
        var y = x&3;		// y == 1/x mod 2^2
        y = (y*(2-(x&0xf)*y))&0xf;	// y == 1/x mod 2^4
        y = (y*(2-(x&0xff)*y))&0xff;	// y == 1/x mod 2^8
        y = (y*(2-(((x&0xffff)*y)&0xffff)))&0xffff;	// y == 1/x mod 2^16
        // last step - calculate inverse mod DV directly;
        // assumes 16 < DB <= 32 and assumes ability to handle 48-bit ints
        y = (y*(2-x*y%this.DV))%this.DV;		// y == 1/x mod 2^dbits
        // we really want the negative inverse, and -DV < y < DV
        return (y>0)?this.DV-y:-y;
    }

    // Montgomery reduction
    function Montgomery(m) {
        this.m = m;
        this.mp = m.invDigit();
        this.mpl = this.mp&0x7fff;
        this.mph = this.mp>>15;
        this.um = (1<<(m.DB-15))-1;
        this.mt2 = 2*m.t;
    }

    // xR mod m
    function montConvert(x) {
        var r = nbi();
        x.abs().dlShiftTo(this.m.t,r);
        r.divRemTo(this.m,null,r);
        if(x.s < 0 && r.compareTo(BigInteger.ZERO) > 0) this.m.subTo(r,r);
        return r;
    }

    // x/R mod m
    function montRevert(x) {
        var r = nbi();
        x.copyTo(r);
        this.reduce(r);
        return r;
    }

    // x = x/R mod m (HAC 14.32)
    function montReduce(x) {
        while(x.t <= this.mt2)	// pad x so am has enough room later
            x[x.t++] = 0;
        for(var i = 0; i < this.m.t; ++i) {
            // faster way of calculating u0 = x[i]*mp mod DV
            var j = x[i]&0x7fff;
            var u0 = (j*this.mpl+(((j*this.mph+(x[i]>>15)*this.mpl)&this.um)<<15))&x.DM;
            // use am to combine the multiply-shift-add into one call
            j = i+this.m.t;
            x[j] += this.m.am(0,u0,x,i,0,this.m.t);
            // propagate carry
            while(x[j] >= x.DV) { x[j] -= x.DV; x[++j]++; }
        }
        x.clamp();
        x.drShiftTo(this.m.t,x);
        if(x.compareTo(this.m) >= 0) x.subTo(this.m,x);
    }

    // r = "x^2/R mod m"; x != r
    function montSqrTo(x,r) { x.squareTo(r); this.reduce(r); }

    // r = "xy/R mod m"; x,y != r
    function montMulTo(x,y,r) { x.multiplyTo(y,r); this.reduce(r); }

    Montgomery.prototype.convert = montConvert;
    Montgomery.prototype.revert = montRevert;
    Montgomery.prototype.reduce = montReduce;
    Montgomery.prototype.mulTo = montMulTo;
    Montgomery.prototype.sqrTo = montSqrTo;

    // (protected) true iff this is even
    function bnpIsEven() { return ((this.t>0)?(this[0]&1):this.s) == 0; }

    // (protected) this^e, e < 2^32, doing sqr and mul with "r" (HAC 14.79)
    function bnpExp(e,z) {
        if(e > 0xffffffff || e < 1) return BigInteger.ONE;
        var r = nbi(), r2 = nbi(), g = z.convert(this), i = nbits(e)-1;
        g.copyTo(r);
        while(--i >= 0) {
            z.sqrTo(r,r2);
            if((e&(1<<i)) > 0) z.mulTo(r2,g,r);
            else { var t = r; r = r2; r2 = t; }
        }
        return z.revert(r);
    }

    // (public) this^e % m, 0 <= e < 2^32
    function bnModPowInt(e,m) {
        var z;
        if(e < 256 || m.isEven()) z = new Classic(m); else z = new Montgomery(m);
        return this.exp(e,z);
    }

    // protected
    BigInteger.prototype.copyTo = bnpCopyTo;
    BigInteger.prototype.fromInt = bnpFromInt;
    BigInteger.prototype.fromString = bnpFromString;
    BigInteger.prototype.clamp = bnpClamp;
    BigInteger.prototype.dlShiftTo = bnpDLShiftTo;
    BigInteger.prototype.drShiftTo = bnpDRShiftTo;
    BigInteger.prototype.lShiftTo = bnpLShiftTo;
    BigInteger.prototype.rShiftTo = bnpRShiftTo;
    BigInteger.prototype.subTo = bnpSubTo;
    BigInteger.prototype.multiplyTo = bnpMultiplyTo;
    BigInteger.prototype.squareTo = bnpSquareTo;
    BigInteger.prototype.divRemTo = bnpDivRemTo;
    BigInteger.prototype.invDigit = bnpInvDigit;
    BigInteger.prototype.isEven = bnpIsEven;
    BigInteger.prototype.exp = bnpExp;

    // public
    BigInteger.prototype.toString = bnToString;
    BigInteger.prototype.negate = bnNegate;
    BigInteger.prototype.abs = bnAbs;
    BigInteger.prototype.compareTo = bnCompareTo;
    BigInteger.prototype.bitLength = bnBitLength;
    BigInteger.prototype.mod = bnMod;
    BigInteger.prototype.modPowInt = bnModPowInt;

    // "constants"
    BigInteger.ZERO = nbv(0);
    BigInteger.ONE = nbv(1);

    // Export.
    BigIntegerModule.BigInteger = BigInteger;
}));
// </jsbn>

/**
 * Create user object name space.
 * @type {{}}
 */
eb.comm.createUO = {};
eb.comm.createUO.consts = {
    YES: "yes",
    NO: "no",

    uoType:{
        HMAC: 0x0001,
        SCRAMBLE: 0x0002,
        ENSCRAMBLE: 0x0003,
        PLAINAES: 0x0004,
        RSA1024DECRYPT_NOPAD: 0x0005,
        RSA2048DECRYPT_NOPAD: 0x0006,
        EC_FP192SIGN: 0x0007,
        AUTH_HOTP: 0x0008,
        AUTH_NEW_USER_CTX: 0x0009,
        AUTH_PASSWORD: 0x000a,
        AUTH_UPDATE_USER_CTX: 0x000b,
        TOKENIZE: 0x000c,
        DETOKENIZE: 0x000d,
        TOKENIZEWRAP: 0x000e,
        PLAINAESDECRYPT: 0x000f,
        RANDOMDATA: 0x0010,
        CREATENEWUO: 0x0011,
        RSA1024ENCRYPT_NOPAD: 0x0012,
        RSA2048ENCRYPT_NOPAD: 0x0013
    },

    environment:{
        DEV: "dev",
        TEST: "test",
        PROD: "prod"
    },

    maxtps: {
        _1: "one",
        _10: "ten",
        _20: "twenty",
        _50: "fifty",
        _100: "one_hundred",
        _200: "two_hundred",
        _500: "five_hundred",
        _1000: "one_thousand",
        _2000: "two_thousand",
        _5000: "five_thousand",
        _10000: "ten_thousand",
        _50000: "fifty_thousand",
        _100000: "hundred_thousand",
        UNLIMITED: "unlimited"
    },

    core: {
        EMPTY: "empty",
        _1: "one",
        _2: "two",
        _3: "three",
        _5: "five",
        _10: "ten",
        _20: "twenty",
        CLUSTER: "cluster"
    },

    persistence: {
        _1min: "one_minute",
        _2min: "two_minutes",
        _5min: "five_minutes",
        _15min: "fifteen_minutes",
        _30min: "thirty_minutes",
        _1h: "one_hour",
        _2h: "two_hours",
        _6h: "six_hours",
        _12h: "twelve_hours",
        _1d: "one_day",
        _2d: "two_days",
        _7d: "seven_days",
        _14d: "forteen_days",
        _28d: "twentyeight_days",
        _1mon: "one_month"
    },

    priority: {
        LOW: "low",
        DEFAULT: "default",
        HIGH: "high",
        MAX: "maximum"
    },

    separation: {
        TIME: "time",
        COMPLETE: "complete"
    },

    resource: {
        GLOBAL: "global",
        INSTANCE: "instance",
        CLUSTER: "cluster",
        CARD: "card"
    },

    genKey: {
        LEGACY_RANDOM: 0,
        CLIENT: 1,
        COMP1: 2,
        COMP2: 3,
        COMP3: 4,
        SERVER_RANDOM: 5,
        SERVER_DERIVED: 6
    }
};

eb.comm.createUO.utils = {
    getUoType: function(fnc, clientGenAppKey, clientGenComKey){
        var uotype  = fnc;
        uotype |= isChecked(chkEbAppGen) ? 1<<21 : 0;
        uotype |= isChecked(chkEbComGen) ? 1<<20 : 0;
        return uotype;
    }
};

/**
 * getUOTemplate response.
 * @extends eb.comm.response
 */
eb.comm.createUO.UOTemplateResponse = function(x){
    eb.misc.absorb(this, x);
};
eb.comm.createUO.UOTemplateResponse.inheritsFrom(eb.comm.response, {
    /**
     * Response fields
     */
    uot: {
        "objectid": undefined,
        "version": undefined, //<integer>,
        "protocol": undefined, //<integer>,
        "encryptionoffset": undefined, //<decimal_number>,
        "flagoffset": undefined, //<decimal_number>,
        "policyoffset": undefined, //<decimal_number>,
        "scriptoffset": undefined, //<decimal_number,
        "keyoffsets": [
            //{"type": "commk",  offset: 180, length: 20,  "tlvtype":1},
            //{"type": "comenc",  offset: 200, length: 10,  "tlvtype":1},
            //{"type": "commac",  offset: 210, length: 10,  "tlvtype":2},
            //{"type": "billing", offset: 220, length: 10,  "tlvtype":3},
            //{"type": "comnextenc", offset: 230, length: 10,  "tlvtype":4},
            //{"type": "conextmac", offset: 240, length: 10,  "tlvtype":5},
            //{"type": "app",    offset: 250, length: 200, "tlvtype":6}
        ],
        "template": undefined, // hexcoded
        "templatehs": undefined, // hexcoded
        "importkeys": [
            //{"id": <string>, "type":<"rsa2048"|"rsa1024">, "publickey": <string-serialized public key> },
        ],
        "authorization": undefined //<string>
    }
});

/**
 * Create new UO requests
 */
eb.comm.createUO.getUOTemplateRequest = function(){
    this.callFunction = "GetUserObjectTemplate";
};
eb.comm.createUO.getUOTemplateRequest.inheritsFrom(eb.comm.apiRequest, {
    objName: "getUOTemplateRequest",

    /**
     * Default request values.
     * @const
     */
    defaults: {
        "format": 1,        //<integer, starting with 1>,
        "protocol": 1,      //<integer, starting with 1>,
        "type": eb.comm.createUO.consts.uoType.PLAINAES,        //<32bit integer>,
        "environment": eb.comm.createUO.consts.environment.DEV, // shows whether the UO should be for production (live), test (pre-production testing), or dev (development)
        "maxtps": eb.comm.createUO.consts.maxtps.UNLIMITED, // maximum guaranteed TPS
        "core": eb.comm.createUO.consts.core.EMPTY, // how many cards have UO loaded permanently
        "persistence": eb.comm.createUO.consts.persistence._1min, // once loaded onto card, how long will the UO stay there without use (this excludes the "core")
        "priority": eb.comm.createUO.consts.priority.DEFAULT, // this defines a) priority when the server capacity is fully utilised and it also defines how quickly new copies of UO are installed (pre-empting icreasing demand)
        "separation": eb.comm.createUO.consts.separation.TIME, // "complete" = only one UO can be loaded on a smartcard at one one time
        "bcr": eb.comm.createUO.consts.YES,      // "yes" will ensure the UO is replicated to provide high availability for any possible service disruption
        "unlimited": eb.comm.createUO.consts.YES,
        "clientiv": eb.comm.createUO.consts.YES, //  if "yes", we expect the data starts with an IV to initialize decryption of data - this is for communication security
        "clientdiv": eb.comm.createUO.consts.NO, // if "yes", we expect the data starting with a diversification 16B for communication keys
        "resource": eb.comm.createUO.consts.resource.GLOBAL,
        "credit": 256, // <1-32767>, a limit a seed card can provide to the EB service
        "generation": {
            "commkey": eb.comm.createUO.consts.genKey.SERVER_RANDOM,
            "billingkey": eb.comm.createUO.consts.genKey.SERVER_RANDOM,
            "appkey": eb.comm.createUO.consts.genKey.SERVER_RANDOM
        }
    },

    /**
     * Process configuration from the config object.
     * @param configObject java object with the configuration.
     */
    configure: function(configObject){
        if (!configObject){
            this._log("Invalid config object");
            return;
        }

        var toConfig = configObject;
        if ("userObjectId" in configObject){
            toConfig = $.extend(true, toConfig, {apiKeyLow4Bytes : configObject.userObjectId});
        }

        // Configure with parent.
        eb.comm.createUO.getUOTemplateRequest.superclass.configure.call(this, toConfig);
    },

    /**
     * Initializes state and builds request
     * @param {object} request
     */
    build: function(request){
        this._log("Building request body");

        // Request header data.
        this.buildApiBlock(this.apiKey, this.userObjectId);
        this.buildReqHeader();
        this.reqBody = {data:this.defaults};
        this.reqBody.data = $.extend(true, this.reqBody.data, request || {});

        var nonce = this.getNonce();
        var url = this.getApiUrl();
        this._log("Nonce generated: " + nonce);
        this._log("URL: " + url + ", method: " + this.requestMethod);
        this._log("SocketReq: " + JSON.stringify(this.getSocketRequest()));
        this._log("Data: " + JSON.stringify(this.reqBody));
    },

    /**
     * Returns response parser when is needed. May lazily initialize parser.
     * Override point.
     *
     * @returns {*}
     */
    getResponseParser: function(){
        // Generic parser with given parsing function.
        var parser = new eb.comm.responseParser();
        parser.parsingFunction(function(data, resp, parser){
            var response = new eb.comm.createUO.UOTemplateResponse(resp);
            if (!data.data ) {
                parser._log("Invalid response");
                throw new eb.exception.invalid("Invalid response");
            }

            response.uot = data.data;
            return response;
        });

        this.responseParser = parser;
        return this.responseParser;
    }
});

eb.comm.asn1decoder = function(options){
    this.logger = options.logger;
};
eb.comm.asn1decoder.prototype = {
    llog: function(lvl, msg){
        if (this.logger){
            this.logger("|" + ("--".repeat(lvl)) + msg);
        }
    },
    parse: function(buffer, lvl) {
        var w = sjcl.bitArray;
        var result = {};
        var position = 0;
        this.llog(lvl, "Parsing: " + sjcl.codec.hex.fromBits(buffer));

        result.cls = getClass();
        result.structured = getStructured();
        result.tag = getTag();
        var length = getLength(); // As encoded, which may be special value 0

        if (length === 0x80) {
            length = 0;
            while (getByte(position + length) !== 0 || getByte(position + length + 1) !== 0) {
                length += 1;
            }
            result.byteLength = position + length + 2;
            result.contents = w.bitSlice(buffer, 8*position, 8*(position + length));
        } else {
            result.byteLength = position + length;
            result.contents = w.bitSlice(buffer, 8*position, 8*(result.byteLength));
        }

        var doProcess = result.structured;

        // BIT-STRING?
        if (result.cls == 0 && result.tag == 3){
            doProcess = true;
            var unusedBits = w.extract(buffer, 8*position, 8);
            result.contents = w.bitSlice(buffer, 8*(position+1), 8*(result.byteLength)-unusedBits);
        }

        result.clen = w.bitLength(result.contents)/8;
        result.sub = [];
        this.llog(lvl, sprintf("Cur: tag: %02d, cls: %02d, struct: %d, len: %04d", result.tag, result.cls, result.structured, result.clen));

        if (doProcess){
            var subElem = undefined, subContent = result.contents, idx=0;
            do {
                this.llog(lvl, "Parsing sub: " + idx);
                subElem = this.parse(subContent, lvl === undefined ? 1 : lvl+1);
                if (subElem) {
                    result.sub.push(subElem);
                } else {
                    break;
                }

                if (subElem.byteLength !== undefined) {
                    subContent = w.bitSlice(subContent, 8*subElem.byteLength);
                    this.llog(lvl, "Bytes left: " + (w.bitLength(subContent)/8));
                }
                idx += 1;
            } while(subElem && w.bitLength(subContent) > 0);
        }

        return result;

        // Function for recursive calls - keeps context.
        function getByte(offset){
            return w.extract(buffer, offset * 8, 8);
        }

        function getClass() {
            return (getByte(position) & 0xc0) / 64;
        }

        function getStructured() {
            return ((getByte(position)) & 0x20) === 0x20;
        }

        function getTag() {
            var tag = getByte(0) & 0x1f;
            position += 1;
            if (tag === 0x1f) {
                tag = 0;
                while (getByte[position] >= 0x80) {
                    tag = tag * 128 + getByte(position) - 0x80;
                    position += 1;
                }
                tag = tag * 128 + getByte(position) - 0x80;
                position += 1;
            }
            return tag;
        }

        function getLength() {
            var length = 0;

            if (getByte(position) < 0x80) {
                length = getByte(position);
                position += 1;
            } else {
                var numberOfDigits = getByte(position) & 0x7f;
                position += 1;
                length = 0;
                for (var i = 0; i < numberOfDigits; i++) {
                    length = length * 256 + getByte(position);
                    position += 1;
                }
            }
            return length;
        }
    }
};

/**
 * Template filler
 *
 * @param {object} options
 * @param {object} options.template
 * @param {boolean} options.debuggingLog
 * @param {Function} options.logger
 */
eb.comm.createUO.templateFiller = function(options){
    options = options || {};
    this.template = options.template;
    this.debuggingLog = options.debuggingLog || true;
    this.logger = options.logger;
};
eb.comm.createUO.templateFiller.prototype = {
    /**
     * Builds template to import.
     * keys:
     *  commk: {key: bits}
     *  app: {key: bits}
     */
    build: function(options){
        options = options || {};
        var template = options.template || this.template;
        var keys = options.keys || {};

        // Vars.
        var h = sjcl.codec.hex, w = sjcl.bitArray, i, ln, cKeyOff, cKey, cKeyVal, baOrig;
        var baPlain, baProtected;

        // Message shortcuts.
        var encOffset = template.encryptionoffset;
        var keysOffset = template.keyoffsets || [];
        var importKeys = template.importkeys || [];

        // Raw template to fill-in.
        var ba = eb.misc.inputToBits(template.template);

        // Fill in template keys?
        for(i = 0, ln = keysOffset.length; i < ln; ++i){
            cKeyOff = keysOffset[i];
            if (!cKeyOff || !cKeyOff.type || !(cKeyOff.type in keys)){
                this._log("Key not found: " + cKeyOff.type);
                continue;
            }

            cKey = keys[cKeyOff.type];
            cKeyVal = eb.misc.inputToBits(cKey.key);
            if (w.bitLength(cKeyVal) != cKeyOff.length){
                this._log("Key bitLength does not match: " + w.bitLength(cKeyVal) + " vs " + cKeyOff.length);
                continue;
            }

            // before + key + after
            baOrig = ba;
            ba = w.concat(w.bitSlice(baOrig, 0, cKeyOff.offset), cKeyVal); // before + key
            ba = w.concat(ba, w.bitSlice(baOrig, cKeyOff.offset + cKeyOff.length)); // after
        }

        // Encrypt template from encOffset.
        baPlain = w.bitSlice(ba, 0, encOffset);
        baProtected = w.bitSlice(ba, encOffset);

        var tek, tmk;
        tek = sjcl.random.randomWords(8);
        tmk = sjcl.random.randomWords(8);
        baProtected = eb.padding.pkcs7.pad(baProtected);
        this._log('Padded plain template: ' + h.fromBits(baProtected) + ", len=" + w.bitLength(baProtected));

        // Symmetric Encryption
        var aes = new sjcl.cipher.aes(tek);
        var hmac = new sjcl.misc.hmac_cbc(new sjcl.cipher.aes(tmk), 16, eb.padding.empty);
        var IV = [0, 0, 0, 0];
        baProtected = sjcl.mode.cbc.encrypt(aes, baProtected, IV, [], true);
        this._log('Encrypted template: ' + h.fromBits(baProtected) + ", len=" + w.bitLength(baProtected));

        // baPlain | baProtected | MAC(baPlain | baProtected)
        ba = w.concat(baPlain, baProtected);
        ba = eb.padding.pkcs7.pad(ba);
        ba = w.concat(ba, hmac.mac(ba));

        // RSA encryption: UOID-4B | TEK | TMK
        var iKey = this._getBestImportKey(importKeys);
        var baRsaEnc = [];
        baRsaEnc = w.concat(baRsaEnc, [parseInt(template.objectid, 16)]);
        baRsaEnc = w.concat(baRsaEnc, tek);
        baRsaEnc = w.concat(baRsaEnc, tmk);
        this._log('To wrap: ' + h.fromBits(baRsaEnc) + ", len=" + w.bitLength(baRsaEnc));
        var wrapped = this._rsaEncrypt(baRsaEnc, iKey);

        // Final template: 0xa1 | len-2B | RSA-ENC-BLOB | 0xa2 | len-2B | encrypted-maced-template
        var finalTpl = [w.partial(8, 0xa1)];
        finalTpl = w.concat(finalTpl, [w.partial(16, w.bitLength(wrapped)/8)]);
        finalTpl = w.concat(finalTpl, wrapped);

        finalTpl = w.concat(finalTpl, [w.partial(8, 0xa2)]);
        finalTpl = w.concat(finalTpl, [w.partial(16, w.bitLength(ba)/8)]);
        finalTpl = w.concat(finalTpl, ba);

        // Return encrypted template.
        return {uo:finalTpl, keyUsed:iKey};
    },

    _rsaEncrypt: function(input, key){
        var iKeyBl = key.type == 'rsa2048' ? 2048 : 1024;
        var data = eb.padding.pkcs15.pad(input, iKeyBl/8, 2);
        this._log('To wrap padded: ' + sjcl.codec.hex.fromBits(data) + ", len=" + sjcl.bitArray.bitLength(data));

        // Deserialize public key, convert to integers, result = (message ^ exponent) mod modulus
        var pubKey = this._readSerializedPubKey(key.key);

        var msg = new eb.math.BigInteger(sjcl.codec.hex.fromBits(data), 16);
        var mod = new eb.math.BigInteger(sjcl.codec.hex.fromBits(pubKey.n), 16);
        var exp = parseInt(sjcl.codec.hex.fromBits(pubKey.e), 16);
        var res = msg.modPowInt(exp, mod);
        return sjcl.codec.hex.toBits(res.toString(16));

        // SJCL BN is terribly slow!!!
        //var msg = sjcl.bn.fromBits(data);
        //var mod = sjcl.bn.fromBits(pubKey.n);
        //var exp = sjcl.bn.fromBits(pubKey.e);
        //
        // Encryption.
        //msg.powermod(exp, mod);
        //return msg.toBits();
    },

    _readSerializedPubKey: function(pubKey){
        // ASN1:
        //PublicKeyInfo ::= SEQUENCE {
        //    algorithm       AlgorithmIdentifier,
        //    PublicKey       BIT STRING
        //}
        //AlgorithmIdentifier ::= SEQUENCE {
        //    algorithm       OBJECT IDENTIFIER,
        //    parameters      ANY DEFINED BY algorithm OPTIONAL
        //}
        //RSAPublicKey ::= SEQUENCE {
        //    modulus           INTEGER,  -- n
        //    publicExponent    INTEGER   -- e
        //}
        //
        // We encode it differently...
        // TAG|len-2B|value. 81 = exponent, 82 = modulus
        var w = sjcl.bitArray;
        var ba = eb.misc.inputToBits(pubKey);
        var result = {};

        var tag, len, pos = 0, dat, ln = w.bitLength(ba)/8;
        for(;pos < ln;){
            tag = w.extract(ba, 8*pos, 8); pos+=1;
            len = w.extract(ba, 8*pos, 16); pos+=2;
            dat = w.bitSlice(ba, 8*pos, 8*(pos+len)); pos+=len;
            switch(tag){
                case 0x81:
                    result.e = dat;
                    break;
                case 0x82:
                    result.n = dat;
                    break;
                default:
                    break;
            }
        }

        if (result.n === undefined || result.e === undefined){
            throw new eb.exception.invalid("Invalid public key");
        }

        return result;
    },

    _getBestImportKey: function(importKeys){
        var i, ln, cKey;
        importKeys = importKeys || [];

        // Search RSA2048.
        var kRsa2048 = undefined;
        var kRsa1024 = undefined;
        for(i=0, ln=importKeys.length; i<ln; i++){
            cKey = importKeys[i];
            if (kRsa1024 === undefined && cKey.type == "rsa1024"){
                kRsa1024 = cKey;
            }
            if (kRsa2048 === undefined && cKey.type == "rsa2048"){
                kRsa2048 = cKey;
            }
        }

        return (kRsa2048 === undefined) ? kRsa1024 : kRsa2048;
    },

    _log:  function(x) {
        if (!this.debuggingLog){
            return;
        }

        if (this.logger){
            this.logger(x);
        } else if (console && console.log){
            console.log(x);
        }
    }
};

/**
 * getUOTemplate response.
 * @extends eb.comm.response
 */
eb.comm.createUO.importUOResponse = function(x){
    eb.misc.absorb(this, x);
};
eb.comm.createUO.importUOResponse.inheritsFrom(eb.comm.response, {
    /**
     * Response fields
     */
    uoi: {
        "uoid": undefined
    }
});

/**
 * Import UO request
 * @extends eb.comm.apiRequest
 */
eb.comm.createUO.importUORequest = function(){
    this.callFunction = "CreateUserObject";
};
eb.comm.createUO.importUORequest.inheritsFrom(eb.comm.apiRequest, {
    objName: "CreateUserObject",

    /**
     * Default request values.
     * @const
     */
    defaults: {
        "objectid": undefined,       // 0x10
        "object": undefined,       // '0011223344556677'
        "authorization": ""
    },

    /**
     * Process configuration from the config object.
     * @param configObject java object with the configuration.
     */
    configure: function(configObject){
        if (!configObject){
            this._log("Invalid config object");
            return;
        }

        var toConfig = configObject;
        if ("userObjectId" in configObject){
            toConfig = $.extend(true, toConfig, {apiKeyLow4Bytes : configObject.userObjectId});
        }

        // Configure with parent.
        eb.comm.createUO.importUORequest.superclass.configure.call(this, toConfig);
    },

    /**
     * Initializes state and builds request
     * @param {object} request
     */
    build: function(request){
        this._log("Building request body");

        // Request header data.
        this.buildApiBlock(this.apiKey, this.userObjectId);
        this.buildReqHeader();
        this.reqBody = {data:this.defaults};
        this.reqBody.data = $.extend(true, this.reqBody.data, request || {});

        var nonce = this.getNonce();
        var url = this.getApiUrl();
        this._log("Nonce generated: " + nonce);
        this._log("URL: " + url + ", method: " + this.requestMethod);
        this._log("SocketReq: " + JSON.stringify(this.getSocketRequest()));
        this._log("Data: " + JSON.stringify(this.reqBody));
    },

    /**
     * Returns response parser when is needed. May lazily initialize parser.
     * Override point.
     *
     * @returns {*}
     */
    getResponseParser: function(){
        // Generic parser with given parsing function.
        var parser = new eb.comm.responseParser();
        parser.parsingFunction(function(data, resp, parser){
            var response = new eb.comm.createUO.importUOResponse(resp);
            if (!data.data ) {
                parser._log("Invalid response");
                throw new eb.exception.invalid("Invalid response");
            }

            response.uoi = data.data;
            return response;
        });

        this.responseParser = parser;
        return this.responseParser;
    }
});

