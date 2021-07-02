<?php

//error_reporting(0);
require 'rets-client.php';
require 'toolbox.php';

const DATA_PATH = '../data';

function main() {
    fetch(2, 'rd', '', 100, false);
    fetch(2, 'ra', '', 100, false);
    fetch(2, 'ld', '', 100, false);

    //fetch("RD_1", "data/rd.json", "data/photos-rd",10000);
    //fetch("RA_2", "data/ra.json", "data/photos-ra",10000);
    //fetch("LD_4", "data/ld.json", "data/photos-ld",10000);
}
main();

// fetches the given class of property with trans date after the given the trans date. TODO: for now we don't care about trans date and just fetch everything. 
function fetch($fetch_id, $class, $lastTranDate, $limit=null, $exclude_no_photos = true) {

    print "Fetching class $class ... \n";
    
    global $rets;

    $name_map = [
        'rd' => 'RD_1',
        'ra' => 'RA_2',
        'ld' => 'LD_4'
    ];

    $fetch_path = DATA_PATH."/fetch-$fetch_id"; 

    /*if (file_exists($fetch_path)) {        
        print "ERROR: fetch with id $fetch_id already exists! Choose another id.\n\n";
        die();
    }*/
    if (!file_exists($fetch_path))
        mkdir($fetch_path) or die("ERROR: cannot make the fetch folder.");

    $filepath = "$fetch_path/$class.json";
    $mediapath = DATA_PATH."/photos-$class";
    
    // TODO: take into account $lastTranDate
    $count = $rets->CreateDataFile('Property', $name_map[$class],'(L_Status=|1_0),(L_UpdateDate=2021-01-09T19:35:00-)',null,$limit, $filepath, $mediapath, $exclude_no_photos);

    //$count = $rets->CreateDataFile('Property',$name_map[$class],'(L_UpdateDate=2021-02-20T19:35:00-)',null,$limit, $filepath, $mediapath, $exclude_no_photos);

    print "\n\n$count Records fetched for class $class!\n\n";
}


?>
