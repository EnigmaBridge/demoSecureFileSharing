"use strict";
var defaults = {
    site: 'site1.enigmabridge.com',
    site1: 'site1.enigmabridge.com',
    site2: 'site2.enigmabridge.com'
};

// configuration
var shareConfig = {
    baseUrl: window.location.origin ? window.location.origin : 'https://enigmalink.io',
    downloadHandler: '/d',
    shareFolderName: 'EnigmaLink',
    clientId: '1044449456843-q4lt3nk61gulb67irbr45jvcr2siqfks.apps.googleusercontent.com',
    defaultShareSettings: {
        maskFile: true,
        sizeConceal: true,
        pngWrap: true
    },
    ebConfigUploadLegacy: {
        apiKey:       'TEST_API',
        remoteEndpoint:'site2.enigmabridge.com',
        userObjectId: 'EE01',
        method:       'PLAINAES',
        encKey:       'e134567890123456789012345678901234567890123456789012345678901234',
        macKey:       'e224262820223456789012345678901234567890123456789012345678901234',
        comKey:       undefined
    },
    ebConfigDownloadLegacy: {
        apiKey:       'TEST_API',
        remoteEndpoint:'site2.enigmabridge.com',
        userObjectId: 'EE02',
        method:       'PLAINAES',
        encKey:       'e134567890123456789012345678901234567890123456789012345678901234',
        macKey:       'e224262820223456789012345678901234567890123456789012345678901234',
        comKey:       undefined
    },
    ebConfigUploadUmphOld: {
        apiKey:       'TEST_API',
        uotype:       0x4,
        remoteEndpoint:'site1.enigmabridge.com',
        userObjectId: '7b',
        method:       'PLAINAES',
        encKey:       'f489e056b04f8af72c959326933ccb15a0bf2aaac18d59d8a8d3c07cf45f18ec',
        macKey:       'aedcd9c1f0f2737fbd7da5242868a5bdb2a3afbab14000e03772e4d7da1f10d6',
        comKey:       '4b27a1db039f0c8566d307ef03dde031'
    },
    ebConfigDownloadUmphOld: {
        apiKey:       'TEST_API',
        uotype:       0xf,
        remoteEndpoint:'site1.enigmabridge.com',
        userObjectId: '79',
        method:       'PLAINAESDECRYPT',
        encKey:       '1c71e939a348938c61eee1d12769f23c7e2a93e689f0cc065a916f9af29e73dd',
        macKey:       '710b8ff6b9ac669cd437cb32d442c394206922dcab2dd8b6c52715dd0fac72c6',
        comKey:       'e69cd6dd17447ecb676325aa2baf513e'
    },
    ebConfigUpload: {
        apiKey:       'TEST_API',
        uotype:       0x4,
        remoteEndpoint:'site1.enigmabridge.com',
        userObjectId: '7d',
        method:       'PLAINAES',
        encKey:       '6d8cd10dea702ba590aa580d711ff36d30e3d33d5d4173f29f2507a002c09857',
        macKey:       'f724d2afdbd8c861dc90baa18301e8df47eccada838a3d8b1bc0cf647a4d7213',
        comKey:       '3062fd96f932e47578455dd682da532f'
    },
    ebConfigDownload: {
        apiKey:       'TEST_API',
        uotype:       0xf,
        remoteEndpoint:'site1.enigmabridge.com',
        userObjectId: '7f',
        method:       'PLAINAESDECRYPT',
        encKey:       '06fdfbfe8649517ee963107a5395b954437d87c010596d73902320542e50569c',
        macKey:       '4d87d90a69e9459951272f88662924d9adf311d683530bca408764959a1fb765',
        comKey:       '156872c8734e32e17d4e48557bc0486c'
    }
};

shareConfig.sharedFolderQuery = {
        'q': "mimeType='application/vnd.google-apps.folder'" +
        " and name='" + shareConfig.shareFolderName + "' " +
        " and trashed=false " +
        " and 'root' in parents",
        'fields': "nextPageToken, files(id, name)"
};

shareConfig.shareFolderCreate = {
    resource: {
        'name' : shareConfig.shareFolderName,
        'mimeType' : 'application/vnd.google-apps.folder'
    },
    fields: 'id'
};

function getProxyRedirLink(fileId){
    return sprintf("%s/proxy-redir.php?id=%s", shareConfig.baseUrl, encodeURIComponent(fileId));
}

// Embedding PNG image.
var pngImg = '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';

