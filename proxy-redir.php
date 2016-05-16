<?php
//    PHP following location redirect.
//    Motivation:
//
//    HTTP Status for: "https://drive.google.com/uc?export=download&id=0B4ObafdOo3JwbWtYa2ZjNWxRUk0"
//
//    HTTP/1.0 302 Moved Temporarily
//    Content-Type: text/html; charset=UTF-8
//    Cache-Control: no-cache, no-store, max-age=0, must-revalidate
//    Pragma: no-cache
//    Expires: Mon, 01 Jan 1990 00:00:00 GMT
//    Date: Mon, 16 May 2016 12:31:40 GMT
//    Location: https://doc-00-a8-docs.googleusercontent.com/docs/securesc/ha0ro937gcuc7l7deffksulhg5h7mbp1/o67lipkenkdscrb093772hg3cvptel00/1463400000000/03824231233236046308/*/0B4ObafdOo3JwbWtYa2ZjNWxRUk0?e=download
//    P3P: CP="This is not a P3P policy! See https://support.google.com/accounts/answer/151657?hl=en for more info."
//    X-Content-Type-Options: nosniff
//    X-Frame-Options: SAMEORIGIN
//    X-XSS-Protection: 1; mode=block
//    Server: GSE
//    Set-Cookie: NID=79=aZdIAPcmfNJegSmVGgWvn14auo1uc4u-UwDFwiwtPMPZhjwMbcNTTP8g_nc1wvfQqnrX500JZI24L4FMfnmJyqo7jxva1wnLEeLe9ZUJm-mkHvd5HBs1rsRVWoiYoT8q;Domain=.google.com;Path=/;Expires=Tue, 15-Nov-2016 12:31:40 GMT;HttpOnly
//    Alternate-Protocol: 443:quic
//    Alt-Svc: quic=":443"; ma=2592000; v="33,32,31,30,29,28,27,26,25"
//    Accept-Ranges: none
//    Vary: Accept-Encoding
//
//    HTTP/1.0 200 OK
//    X-GUploader-UploadID: AEnB2UrrK4ETC0yBhk8Qicj2TE6lb8daG0mkaMbzgM467nqYU-8iUTJS8qE3ZrG36nAR7_5zMm_OpiLZHin8_NNXa-z1orscTw
//    Access-Control-Allow-Origin: *
//    Access-Control-Allow-Credentials: false
//    Access-Control-Allow-Methods: GET,OPTIONS
//    Content-Type: application/octet-stream
//    Content-Disposition: attachment;filename="uf7bv2kqsdro";filename*=UTF-8''uf7bv2kqsdro
//    Date: Mon, 16 May 2016 12:31:40 GMT
//    Expires: Mon, 16 May 2016 12:31:40 GMT
//    Cache-Control: private, max-age=0
//    X-Goog-Hash: crc32c=4Dbqog==
//        Content-Length: 1024
//    Server: UploadServer
//    Alternate-Protocol: 443:quic
//    Alt-Svc: quic=":443"; ma=2592000; v="33,32,31,30,29,28,27,26,25"

$id = $_REQUEST['id'];
$mode = $_REQUEST['mode'];
if (empty($mode)){
    $mode=1;
}

if (empty($id)){
    $id="0B4ObafdOo3JwbWtYa2ZjNWxRUk0";
//    header($_SERVER["SERVER_PROTOCOL"]." 404 Not Found", true, 404);
//    die("ID not specified");
}

$url = "https://drive.google.com/uc?export=download&id=" . urlencode($id);

// CORS
header('Access-Control-Allow-Origin: *'); // TODO: add our domains.
header('Access-Control-Allow-Credentials: false');
header('Access-Control-Allow-Methods: GET,OPTIONS');

// Do the request
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_HEADER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, false);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, TRUE);
curl_setopt($ch, CURLOPT_TIMEOUT, 5);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, 0);
curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
$response = curl_exec($ch);

// Get & parse headers.
$bh = explode("\r\n\r\n", $response, 3);
$header = parseHeaders($bh[0]);
$status = $header['status'];
if ($header['status']==100){ //use the other "header"
    $header=parseHeaders($bh[1]);
}

if ($status!=302){
    die("{'status': 'error', 'error':'Unsupported'}");
}

if ($mode == 2) {
    header('Location: ' . $header['Location'][0], true, 302);
}

// Cookies.
setHeaderIfAny($header, 'Set-Cookie');

// Construct response JSON.
$json = new stdClass();
$json->status = 'ok';
$json->url = $header['Location'][0];
if (isset($header['Set-Cookie'])) {
    $json->cookie = $header['Set-Cookie'];
}

die(json_encode($json));

// ---------------------------------------------------------------------------------------------------------------------
function setHeaderIfAny($headers, $header){
    if (!isset($headers[$header])){
        return;
    }

    foreach($headers[$header] as $value){
        header($header . ': ' . $value);
    }
}

/**
 * Parse a set of HTTP headers
 *
 * @param array The php headers to be parsed
 * @param [string] The name of the header to be retrieved
 * @return A header value if a header is passed;
 *         An array with all the headers otherwise
 */
function parseHeaders($headers, $header = null)
{
    $output = array();
    $headers = explode("\r\n", $headers);

    if ('HTTP' === substr($headers[0], 0, 4)) {
        list(, $output['status'], $output['status_text']) = explode(' ', $headers[0]);
        unset($headers[0]);
    }

    foreach ($headers as $v) {
        $h = preg_split('/:\s*/', $v, 2);
        $output[$h[0]][] = $h[1];
    }

    if (null !== $header) {
        if (isset($output[$header])) {
            return $output[$header];
        }

        return;
    }

    return $output;
}


