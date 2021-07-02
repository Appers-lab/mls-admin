<?php

error_reporting(0);
require 'rets-client.php';
require 'toolbox.php';

const META_PATH = '../meta';

function main() {
    print "Getting meta data ... \n";

    $lookups = get_lookups();
    //var_dump($lookups);


    foreach(['rd', 'ra', 'ld'] as $class) {
        $raw_data = get_fields_raw($class);
        //var_dump($rd_data);
    
        $ans = create_field_info($raw_data, $lookups);

        write($ans, META_PATH."/fields-$class.json");
    }
}
main();

function create_field_info($raw_data, $lookups) {

    $fields_info = [];
    $sys_to_db = [];

    foreach($raw_data as $sysname => $info)  {
        if (!$info['DBName']) continue;

        $sys_to_db[$sysname] = $info['DBName'];

        $temp = $info;

        if ($temp['LookupName']) {
            $temp['lookup'] = $lookups[$temp['LookupName']];            
        }
        unset($temp['LookupName']);

        $fields_info[$info['DBName']] = $temp;
    }

    return [
        'sysToDb' => $sys_to_db,
        'info' => $fields_info
    ];
}


/**
 * @param class - property classes: ra, ld, ml, ld
 */
function get_fields_raw($class) {

    print "Getting field data for class $class... \n";

    global $rets;

    $name_map = [
        'rd' => 'RD_1',
        'ra' => 'RA_2',
        'ld' => 'LD_4'
    ];

    $path = META_PATH."/_fields_$class.raw.json";

    if (file_exists($path)) {
        print "Raw fields data is already fetched.\n";
        return json_decode(read($path), true);
    }
    else {
        $rets_class = $name_map[$class];
        $res=$rets->GetMetadata('METADATA-TABLE',"Property:$rets_class");
        $data = fields_to_array($res);
        write($data, $path);
        return $data;
    }
}

function get_lookups() {
    print "Getting lookups data ... \n";

    global $rets;
    $path = META_PATH.'/_lookups.raw.json';

    if (file_exists($path)) {
        print "Lookups data is already fetched.\n";
        return json_decode(read($path), true);
    }
    else {
        print "Fetching from the RETS server ... ";
        $res=$rets->GetMetadata('METADATA-LOOKUP_TYPE','Property:*');
        $data = lookups_to_array($res);
        write($data, $path);
        return $data;    
    }
}

function fields_to_array($response) {
    $data = null;
    $columns=array();
    $xml = new XMLReader();
    $xml->XML($response);
    //$nRec = sizeof($data);
    while ($xml->read()) {
        #var_dump($columns);
        if ($xml->nodeType == XMLReader::END_ELEMENT) {
        continue;
        } elseif ($xml->name=="DATA") {
        $xml->read();
        $datline = $xml->value;
        $datline = preg_replace('/^[^\t]*\\t/', "", $datline);
        $datline = preg_replace('/\\t[^\t]*$/', "", $datline);
        $col=0;
        foreach (preg_split('/\t/', $datline) as $datvalue) {
            $dataArray[$columns[$col]] = $datvalue;
            $col++;
        }
        $data[$dataArray["SystemName"]]=$dataArray;
        //$nRec++;
        continue;
        } elseif ($xml->name=="COLUMNS") {
        $xml->read();
        #only load columns for the first batch; it needs to be the same for subsequent requests
        if (sizeof($columns)==0) {
            $colline = $xml->value;
            $colline = preg_replace('/^[^\t]*\\t/', "", $colline);
            $colline = preg_replace('/\\t[^\t]*$/', "", $colline);
            $col=0;
            foreach (preg_split('/\t/', $colline) as $systemname) {
                $columns[$col] = $systemname;
                $col++;
            }
        }
        continue;
        }
    }
    return $data;
}


function lookups_to_array($response) {
    $data = null;
    $columns=array();
    $xml = new XMLReader();
    $xml->XML($response);
    //$nRec = sizeof($data);
    $lookup = "gg";
    while ($xml->read()) {        
        if ($xml->nodeType == XMLReader::END_ELEMENT) {
            continue;    
    
        } elseif ($xml->name=="METADATA-LOOKUP_TYPE") {
            //print "lookup type ....\n==================================\n";
            $lookup = $xml->getAttribute("Lookup");
            $data[$lookup] = [];

        } elseif ($xml->name=="DATA") {
            $xml->read();
            $datline = $xml->value;
            $datline = preg_replace('/^[^\t]*\\t/', "", $datline);
            $datline = preg_replace('/\\t[^\t]*$/', "", $datline);
            $col=0;

            foreach (preg_split('/\t/', $datline) as $datvalue) {
                $dataArray[$columns[$col]] = $datvalue;
                $col++;
            }

            $data[$lookup][$dataArray["Value"]]=$dataArray;        
            continue;

        } elseif ($xml->name=="COLUMNS") {
            $columns = [];
            $xml->read();
            $colline = $xml->value;
            $colline = preg_replace('/^[^\t]*\\t/', "", $colline);
            $colline = preg_replace('/\\t[^\t]*$/', "", $colline);
            $col=0;
            foreach (preg_split('/\t/', $colline) as $systemname) {
                $columns[$col] = $systemname;
                $col++;
            }
        }
        continue;
    }
    return $data;
}


/* Archive code
===============================================

NOT needed for now, but can be moved to a new script in the future
function save_resources($rets, $filepath) {
    $res=$rets->GetMetadata('METADATA-RESOURCE','0');
    write($res, $filepath);
}
function save_classes($rets, $filepath) {
    $res=$rets->GetMetadata('METADATA-CLASS','0');
    write($res, $filepath);
}*/



?>