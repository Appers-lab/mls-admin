<?php 

function write($str, $filepath) {
    $fp = fopen($filepath, 'w');

    if (is_string($str))
        fwrite($fp, $str);
    else
        fwrite($fp, json_encode($str));

    fclose($fp);
}

function read($filepath) {
    $f = fopen($filepath, "r");
    return fread($f, filesize($filepath));
}

function _log($response) {
    print("===============================================================\n");
    var_dump($response);
    print("===============================================================\n\n");
}


?>