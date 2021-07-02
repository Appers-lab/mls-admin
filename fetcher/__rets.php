<?php

error_reporting(0);

$rets = new RETS();
$rets->url='http://reb-stage.apps.retsiq.com/contactstageres/rets/login';
$rets->user='RETSALANMA';
$rets->password='295003309';
$rets->useragent='CMAZilla/4.00';
$rets->useragent_password='1234';
$response=$rets->Login();

/* Main course
============================= */

//save_meta($rets);
fetch($rets, "RD_1", "data/rd.json", "data/photos-rd",10000);
fetch($rets, "RA_2", "data/ra.json", "data/photos-ra",10000);
fetch($rets, "LD_4", "data/ld.json", "data/photos-ld",10000);


//$count = $rets->GetPhoto('Property',"262340505:*", "test-media");
//print "WE GOT $count photos!!!\n\n";

/* Operational functions
============================= */

function fetch($rets, $class, $filepath, $mediapath, $limit=null, $exclude_no_photos = true) {
    //$rets->CreateDataFile('Property',$class,'(L_Status=|1_0),(L_UpdateDate=2021-01-09T19:35:00-)',null,$limit,$filepath, "media");
    print "Fetching class $class ... ";
    $count = $rets->CreateDataFile('Property',$class,'(L_UpdateDate=2021-02-20T19:35:00-)',null,$limit,$filepath, $mediapath, $exclude_no_photos);
    print "\n\n$count Records fetched for class $class!\n\n";
}

function save_meta($rets) {
    //save_resources($rets);
    //save_classes($rets);
    save_fields($rets, "RD_1", "meta/fields_rd_raw.json");
    save_fields($rets, "RA_2", "meta/fields_ra_raw.json");
    save_fields($rets, "LD_4", "meta/fields_ld_raw.json");
    save_lookups($rets, "meta/lookups_raw.json");
}


/*$test = '<RETS ReplyCode="0" ReplyText="Operation Successful">
<METADATA-LOOKUP_TYPE Lookup="AccestoPrp_Lkp_4" Resource="Property" Date="2015-05-22T18:28:57.7Z" Version="15.5.32788">
<COLUMNS>	MetadataEntryID	LongValue	ShortValue	Value	</COLUMNS>
<DATA>	01717B73383EC7B00001	Allowed Access	ALLOW	ALLOW	</DATA>
<DATA>	01717B73383EC7B00002	Lane Access	LANE	LANE	</DATA>
<DATA>	01717B73383EC7B00003	Mixed	MIXED	MIXED	</DATA>
<DATA>	01717B73383EC7B00004	No Access	NONE	NONE	</DATA>
<DATA>	01717B73383EC7B00005	Road Access	ROAD	ROAD	</DATA>
<DATA>	01717B73383EC7B00006	Water Access	WATER	WATER	</DATA>
</METADATA-LOOKUP_TYPE>

<METADATA-LOOKUP_TYPE Lookup="AgeType_Lkp_1" Resource="Property" Date="2015-05-22T18:26:54Z" Version="15.5.32786">
<COLUMNS>	MetadataEntryID	LongValue	ShortValue	Value	</COLUMNS>
<DATA>	0166D2F749E6D3100001	New	NE	NE	</DATA>
<DATA>	0166D2F749E6D3100002	Old Timer	OT	OT	</DATA>
<DATA>	0166D2F749E6D3100003	Under Construction	UC	UC	</DATA>
</METADATA-LOOKUP_TYPE>

<METADATA-LOOKUP_TYPE Lookup="AgeType_Lkp_2" Resource="Property" Date="2015-05-22T18:27:35.4Z" Version="15.5.32787">
<COLUMNS>	MetadataEntryID	LongValue	ShortValue	Value	</COLUMNS>
<DATA>	016A6075EEAD53100001	New	NE	NE	</DATA>
<DATA>	016A6075EEAD53100002	Old Timer	OT	OT	</DATA>
<DATA>	016A6075EEAD53100003	Under Construction	UC	UC	</DATA>
</METADATA-LOOKUP_TYPE>
</RETS>
';
$data = lookups_to_array($test);
var_dump($data);
*/



//===========================================================================
//===========================================================================
class RETS {
    #------------------------------------------------------------------------------------
    # Public Instance Variables
    #
      public $url;
      public $user;
      public $password;
      public $safemls_pin;
      public $useragent;
      public $useragent_password;
      public $rets_version = "RETS/1.7";
    
      public $metadata_types = array(
          "METADATA-SYSTEM",
          "METADATA-RESOURCE",
          "METADATA-FOREIGNKEYS",
          "METADATA-CLASS",
          "METADATA-OBJECT",
          "METADATA-LOOKUP",
          "METADATA-LOOKUP_TYPE",
          "METADATA-TABLE"
        );
    
      public $keyfield="L_ListingID";
      public $batchsize=500;
    #
    #------------------------------------------------------------------------------------
    
    #------------------------------------------------------------------------------------
    # Private Instance Variables
    #
      private $headers = array();
      private $cookies = array();
      private $rets_ua_authorization;
    
      # the following are used for parsing getobject responses
      private $content_type;
      private $content_multipart_boundary;
      private $content_parts;
      private $safemls_serverinfo;
    
      private $login_info = null;
      private $root_url;
    
      # $capbability_urls stores the URLs for the various transaction types
      private $capability_urls = array(
        'Login' => null,
        'Logout' => null,
        'Search' => null,
        'GetMetadata' => null,
        'GetObject' => null,
        'ChangePassword' => null
      );
    
      private $ch = null;
    #
    #------------------------------------------------------------------------------------
    
    #------------------------------------------------------------------------------------
    # Procedure: Login
    #
    # Purpose:   Login to the RETS Server
    #
    # Input:     None
    #
    # Returns:   Returns true if successful
    #
    # Note:      None
    #------------------------------------------------------------------------------------
      public function Login() {
        $login_success = false;
    
        if ($this->safemls_pin == null) {
          print "Logging in ...\n";
          try {
            $response = $this->GetRequest($this->url);
            $login_success = true;
          } catch(Exception $e) {
            $login_success = false;
          }
        } else {
          print "Logging in with SafeMLS ...\n";
          $response = $this->GetRequest($this->url, "", "RETS-Challenge: scheme=\"SAFEMLS\" user=\"$this->user\"", true);
          $response_password = $this->password . $this->safemls_pin;
          try {
            $response = $this->GetRequest($this->url, "", "RETS-Challenge: scheme=\"SAFEMLS\" response=\"$response_password\" challenge=\"safemls\" serverinfo=\"$this->safemls_serverinfo\"", false);
            $login_success = true;
          } catch(Exception $e) {
            $login_success = false;
          }
        }
      
        if ($login_success) {
          print "parse capability urls and store\n";
          try {
            $xml = new XMLReader(); 
            $xml->XML($response);
            while ($xml->read()) {
              if ($xml->name=="RETS-RESPONSE") {
                $xml->read();
                $inner_response = $xml->value;
                break;
              }
            }
      
            # inspect the response and parse the capability urls for other transaction types
            $response_lines = preg_split('/[\r\n]+/', $inner_response, -1, PREG_SPLIT_NO_EMPTY);
            foreach ($response_lines as $line) {
              if ($line=="") {
                continue;
              }
              list($key,$value) = explode("=", $line);
              if (array_key_exists($key, $this->capability_urls)) {
                #if url is relative swap it on to default url
                if (preg_match('/^\//', $value)) {
                  if ($this->root_url=="") {
                    preg_match('@^(?:http://)?([^/]+)@i', $this->url, $matches); 
                    $this->root_url = $matches[0];
                  }
                  $value = $this->root_url.$value;
                }
                $this->capability_urls[$key]=$value;
              }
              else
              {
                $this->login_info[$key]=$value;
              }
            }
          } catch (Exception $e) {
            $login_success = false;      
          }
        }
        return $login_success;
      }
    
    #------------------------------------------------------------------------------------
    # Procedure: Logout
    #
    # Purpose:   Logout from the RETS Server
    #
    # Input:     None
    #
    # Returns:   Returns true if successful
    #
    # Note:      None
    #------------------------------------------------------------------------------------
      public function Logout() {
        print "Logging out ...\n";
        $response = $this->GetRequest($this->capability_urls['Logout']);
        return true;
      }
    
    #------------------------------------------------------------------------------------
    # Procedure: IsValid User
    #
    # Purpose:   Verifies User on RETS Server
    #
    # Input:     None
    #
    # Returns:   Returns true if successful
    #
    # Note:      None
    #------------------------------------------------------------------------------------
      public function isValidUser() {
        $retStatus = $this->Login();
        if ($retStatus) {
          $this->Logout();
        }
        return $retStatus;
      }
    
    #------------------------------------------------------------------------------------
    # Procedure: GetMetadata
    #
    # Purpose:   Retrieves Metadata from the RETS Server
    #
    # Input:     $medadata_type: Type of metadata to retrieve (see $metadata_types)
    #            $id: The ID to retrieve
    #
    # Returns:   Returns the raw response from the RETS Server
    #
    # Note:      This function shows how to retrieve the metadata but does
    #            parse the output in any way. A optimized RETS Client would
    #            cache metadata locally and check for modifications when
    #            deciding whether or not to download a given set of metadata
    #            again.
    #------------------------------------------------------------------------------------
      public function GetMetadata($metadata_type,$id) {
        if (!in_array($metadata_type, $this->metadata_types)) {
          print "Invalid metadata_type. Valid values are:\n";
          foreach ($this->metadata_types as $mdt) {
            print "$mdt\n";
          }
          return "";
        }
        print "Getting Metadata $metadata_type (ID=$id)...\n";
        $request_string=$this->capability_urls['GetMetadata']."?Format=COMPACT&Type=$metadata_type&ID=$id";
        $response = $this->GetRequest($request_string);
        return $response;
      }
    
    #------------------------------------------------------------------------------------
    # Procedure: GetDataKeysArray
    #
    # Purpose:   Retrieves Data Keys from the RETS Server
    #
    # Input:     $resource: RETS Resource
    #            $class: RETS Class
    #            $query: RETS DMQL query
    #            $maxrows: Maximum number of rows of data to retrieve
    #
    # Returns:   Returns RETS key data in an array.
    #
    # Note:      This function parses through a RETS Search response and builds
    #            an array out of the results. For details on DMQL, please set the 
    #            RETS Specification. 
    #------------------------------------------------------------------------------------
      public function GetDataKeysArray($resource,$class,$query,$maxrows) {
        //print "Getting Keys ...\n";
        # get the keys
        $keyresponse = $this->GetDataArray($resource,$class,$query,$this->keyfield,$maxrows);
        return $keyresponse;
      }
    
    #------------------------------------------------------------------------------------
    # Procedure: GetDataArrayFromKeyData
    #
    # Purpose:   Retrieves Data from the RETS Server
    #
    # Input:     $resource: RETS Resource
    #            $class: RETS Class
    #            $query: RETS DMQL query
    #            $selectfields: Comma separated list of fields to select
    #            $keydata: Key Data array from GetDataKeysArray request
    #            $index: Start index
    #            $numrecs: Number of records to return (<200)
    #
    # Returns:   Returns the RETS data in an array.
    #
    # Note:      This function parses through a RETS Search response and builds
    #            an array out of the results. For details on DMQL, please set the 
    #            RETS Specification. 
    #------------------------------------------------------------------------------------
      public function GetDataArrayFromKeyData($resource,$class,$selectfields,$keydata,$index,$numrecs) {
        print "\rGetting Data from Key Data ... $numrecs records starting at $index";
    
        # loop through keys
        $data = null;
        $keystr = "";
        $index_start = $index;
        $index_stop = $index_start + $numrecs;
        if ($index_stop > sizeof($keydata)) {
          $index_stop = sizeof($keydata);
        }
        for ($i=$index; $i<$index_stop; $i++) {
              if (strlen($keystr)>0) {
                $keystr .= ",";
              }
              $keystr .= $keydata[$i][$this->keyfield];
              if ((fmod(($i+1),$numrecs)==0) || $i==sizeof($keydata)-1)  {
                $keyquery = "($this->keyfield=$keystr)";
                $response = $this->GetData($resource,$class,$keyquery,$selectfields,null);
                $this->ParseRetsSearchResponse($response,$data);
                $keystr = "";
            }
        }
        return $data;
      }
    
    #------------------------------------------------------------------------------------
    # Procedure: GetDataArray
    #
    # Purpose:   Retrieves Data from the RETS Server
    #
    # Input:     $resource: RETS Resource
    #            $class: RETS Class
    #            $query: RETS DMQL query
    #            $selectfields: Comma separated list of fields to select
    #            $maxrows: Maximum number of rows of data to retrieve
    #
    # Returns:   Returns the RETS data in an array.
    #
    # Note:      This function parses through a RETS Search response and builds
    #            an array out of the results. For details on DMQL, please set the 
    #            RETS Specification. 
    #------------------------------------------------------------------------------------
      public function GetDataArray($resource,$class,$query,$selectfields,$maxrows) {
        $response = $this->GetData($resource,$class,$query,$selectfields,$maxrows); 
        $data = null;
        $this->ParseRetsSearchResponse($response,$data);
        return $data;
        //return $response;
      }
    
    #------------------------------------------------------------------------------------
    # Procedure: GetData
    #
    # Purpose:   Retrieves data from the RETS Server
    #
    # Input:     $resource: RETS Resource
    #            $class: RETS Class
    #            $query: RETS DMQL query
    #            $selectfields: Comma separated list of fields to select
    #            $maxrows: Maximum number of rows of data to retrieve
    #
    # Returns:   Returns the raw response from the RETS Server
    #
    # Note:      This function shows how to retrieve the metadata but does
    #            parse the output in any way. For details on DMQL, please set the
    #            RETS Specification.
    #------------------------------------------------------------------------------------
      public function GetData($resource,$class,$query,$selectfields,$maxrows) {
        //print "Getting Data ...\n";
        $request_string=$this->capability_urls['Search']."?Format=COMPACT&QueryType=DMQL2&Count=1&SearchType=$resource&Class=$class&Query=$query";
        if ($selectfields!=null) {
          $request_string = $request_string . "&Select=" . $selectfields;
        }
        if ($maxrows!=null) {
          $request_string = $request_string . "&Limit=" . $maxrows;
        }
        $response = $this->GetRequest($request_string);
        return $response;
      }
    
    #------------------------------------------------------------------------------------
    # Procedure: CreateDataFile
    #
    # Purpose:   Retrieves records using full key download and write to file
    #
    # Input:     $resource: RETS Resource
    #            $class: RETS Class
    #            $query: RETS DMQL query
    #            $selectfields: Comma separated list of fields to select
    #            $maxrows: Maximum number of rows of data to retrieve
    #            $filepath: Local path to save data to
    #
    # Returns:   Returns the numeric count of records that match the criteria of the DMQL 
    #            query.
    #
    # Note:      This function parses the count out of the RETS Response. For details on 
    #            DMQL, please set the RETS Specification.
    #------------------------------------------------------------------------------------
    public function CreateDataFile($resource,$class,$query,$selectfields,$maxrows,$outputfile, $media_path="", $drop_no_photos=true) {
        $numkeys=-1;
        $keys=$this->GetDataKeysArray($resource,$class,$query,$maxrows);
        if ($keys!=null) {
            $numkeys=sizeof($keys);
            print "Found $numkeys keys\n";
            if ($numkeys>0) {
                print "Exporting records to $outputfile\n";
                $f = fopen($outputfile, "w");            
                fwrite($f, "[");
                $flag = true;

                $total_count = 0;
                $processed = 0;

                for ($i=0; $i<$numkeys; $i=$i+$this->batchsize) {
                    $response=$this->GetDataArrayFromKeyData($resource,$class,$selectfields,$keys,$i,$this->batchsize);

                    if ($response!=null) {                        
                                                
                        foreach ($response as $key => $value) {
                            
                            $processed++;
                            $count = 1;
                            // getting photos
                            if ($media_path) {
                                $sysid = $value[$this->keyfield];
                                print "\r[Added: $total_count] - Processing $processed/$numkeys -- Getting photos for prop $sysid ... ";
                                $count=$this->GetPhoto('Property',"$sysid:*", $media_path);
                               
                                //_log($res); // => number of photos got
                                print "\r$count photo(s)";
                            }

                            if (!$drop_no_photos || $count ) {
                                if (!$flag) fwrite($f, ",");
                                else $flag=false;
                                $dataline = json_encode($value);
                                fwrite($f, $dataline);
                                $total_count++;
                            }
                            else {
                                //print("NO photos!! SKIPPED\n");
                            }
                        }
                    }
                }
                fwrite($f, "]");
                fclose($f);
            }
        }
        return $total_count;
    }
    
    #------------------------------------------------------------------------------------
    # Procedure: GetCount
    #
    # Purpose:   Retrieves record count from the RETS Server
    #
    # Input:     $resource: RETS Resource
    #            $class: RETS Class
    #            $query: RETS DMQL query
    #
    # Returns:   Returns the numeric count of records that match the criteria of the DMQL 
    #            query.
    #
    # Note:      This function parses the count out of the RETS Response. For details on 
    #            DMQL, please set the RETS Specification.
    #------------------------------------------------------------------------------------
      public function GetCount($resource,$class,$query) {
        print "Getting Count ...\n";
        $request_string=$this->capability_urls['Search']."?Format=COMPACT-DECODED&QueryType=DMQL2&Count=2&SearchType=$resource&Class=$class&Query=$query";
        $response = $this->GetRequest($request_string);
    
        # parse RETS response for count
        $xml = new XMLReader();
        $xml->XML($response);
        $numRec = -1;
        while ($xml->read()) {
          if ($xml->name=="COUNT") {
            if ($xml->getAttribute("Records") != "")
            {
              $numRec = $xml->getAttribute("Records");  
            }
          }
        }
        return $numRec;
      }
    
    #------------------------------------------------------------------------------------
    # Procedure: GetPhoto
    #
    # Purpose:   Retrieves images from the RETS Server
    #
    # Input:     $resource: RETS Resource
    #            $id: RETS Photo ID (see RETS Specification for details)
    #            $filepath: Local path to save images to
    #
    # Returns:   Returns true if successful.
    #
    # Note:      None
    #------------------------------------------------------------------------------------
      public function GetPhoto($resource,$id,$filepath) {
        //print "Getting Photos ...\n";
        $numphotos = 0;
        $request_string=$this->capability_urls['GetObject']."?Location=0&Type=Photo&Resource=$resource&ID=$id";
        $response = $this->GetRequest($request_string);
    
        $this->GetObjectParts();
        //print "Extracting " . count($this->content_parts) . " images ...\n";
        # loop through objects and create files
        $i=0;
        foreach ($this->content_parts as $part) {
            $part_filepath = $filepath . "/" . $part["Content-ID"] . "_" . $part["Object-ID"] . ".jpg";
            
            if (strpos($part["Object"], 'ReplyText="Object Unavailable')!==false || strpos($part["Object"], 'ReplyText="No Object Found')!==false) {
                //print("THIS IS the invalid ==> $part[Object]\n\n");
                continue;
            }

            $fh = fopen($part_filepath, 'w') or die("can't open file $part_filepath");
            fwrite($fh, $part["Object"]);
            fclose($fh);
            $numphotos++;
        }
        return $numphotos;
      }
    
    #------------------------------------------------------------------------------------
    # Procedure: GetRequest
    #
    # Purpose:   Contains common request handling for all RETS Server requests
    #
    # Input:     $url: URL for RETS request
    #            $request_id: An optional request identifier defined by the client
    #            $ignore_errors: A flag indicating that HTTP errors should be ignored
    #
    # Returns:   Returns the raw response from the RETS Server
    #
    # Note:      This method currently only supports HTTP Basic Authentication.
    #            It would need to be enhanced to handle HTTP Digest Authentication.
    #------------------------------------------------------------------------------------
      public function GetRequest($url, $request_id="", $optional_headers=array(), $ignore_errors=false)
      {
         $this->GenerateUAHeader($request_id);
         array_push($optional_headers, 'Accept: */*');
         $cookie_headers = "";
         if ($this->safemls_pin==null && count($this->cookies)==0) {
           # no session cookies exist, so create a session using HTTP Basic Authentication
           #$auth = base64_encode("$this->user:$this->password");
           #array_push($optional_headers, 'Authorization: Basic ' . $auth);
         } else {
           # add any existing cookies to the request
           foreach ($this->cookies as $cookie_name=>$cookie_value) {
             if ($cookie_headers != "") {
               $cookie_headers = $cookie_headers . "; ";
             }
             $cookie_headers = $cookie_headers . "$cookie_name=$cookie_value";
           }
           if ($cookie_headers != "") {
             array_push($optional_headers, "Cookie: " . $cookie_headers);
           }
         }
    
         /*print  "\n\n";
         print "##################################################################################\n";
         print "##################################################################################\n";
         print  "request: " . $url . "\n";
         print  "request headers: " ;*/
    
         $ch = $this->ch;
         if ($ch==null) {
             $ch = curl_init();
             $this->ch = $ch;
         } 
    
         if (stripos($url, "Login")) { #login and get cookie
           curl_setopt($ch, CURLOPT_USERPWD, $this->user.":".$this->password);
         } else { #use cookie for authentication instead of username and password
           curl_setopt($ch, CURLOPT_COOKIE, $cookie_headers);
         }
    
         if ($this->rets_ua_authorization!="") {
             curl_setopt($ch, CURLOPT_HTTPHEADER, array("RETS-UA-Authorization: Digest ".$this->rets_ua_authorization,
                                                   "RETS-Version: " . $this->rets_version));
         } else {
             curl_setopt($ch, CURLOPT_HTTPHEADER, array("RETS-Version: " . $this->rets_version));
         }
    
         $parts = explode("?", $url, 2);
         $url = $parts[0];
         $postdata=null;
         if (sizeof($parts)>1) {
             $postdata = $parts[1];
         }
    
         curl_setopt($ch, CURLOPT_URL, $url);
         curl_setopt($ch, CURLOPT_USERAGENT, $this->useragent);
         curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
         curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 0);
         #curl_setopt($ch, CURLOPT_HEADER, true);
         curl_setopt($ch, CURLOPT_HEADERFUNCTION, array($this,'SetHeader'));
         #curl_setopt($ch, CURLINFO_HEADER_OUT, true);
         curl_setopt($ch, CURLOPT_VERBOSE, false);
         curl_setopt($ch, CURLOPT_HTTPAUTH, CURLAUTH_DIGEST);
         if ($postdata!=null) {
             curl_setopt($ch, CURLOPT_POST, true);
             curl_setopt($ch, CURLOPT_POSTFIELDS, $postdata);
         }
         curl_setopt($ch, CURLOPT_FAILONERROR, false);
         curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
         #curl_setopt($ch, CURLOPT_CRLF, true);
         curl_setopt($ch, CURLOPT_HTTP_VERSION, CURL_HTTP_VERSION_1_1);
         $response = curl_exec($ch);
    
         //var_dump(curl_getinfo($ch,CURLINFO_HEADER_OUT));
         //var_dump($response);
    
          if (curl_errno($ch) != 0) {
            print "Error occurred: ".curl_errno($ch)."\n";
            print "Detail: ".curl_error($ch)."\n";
          }
          else {
            //get the default response headers
            $http_response_header = curl_getinfo($ch);
          }
          #curl_close ($ch);
    
         //print "##################################################################################\n";
    
         #preg_match_all('|Set-Cookie: (.*);|U', $data, $matches);   
         #$cookies = implode(';', $matches[1]);
    #
    #     preg_match_all('/^RETS-Challenge: ?.*scheme=\"SAFEMLS\".* serverinfo=\"(.*)\"/i', $data, $matches);   
    #     $this->safemls_serverinfo = $matches[1];
    #     $cookies = implode(';', $matches[1]);
    
         $this->content = $response;
         /*print "##################################################################################\n";
         print $response;
         print "##################################################################################\n";
         print "##################################################################################\n";*/
    
         return $response;
      }
    
    #------------------------------------------------------------------------------------
    # Procedure: SetHeader
    # Callback function that's fired as cURL objects receive chunks of
    # header data from the server.  Since we don't need to do anything
    # with the headers for this application, this callback function
    # just returns the length of the data it received.
    #------------------------------------------------------------------------------------
    private function SetHeader($ch, $header) {
     if (preg_match('/^set-cookie: ?([^=]*)=([^;]*);/i', $header, $matches)) {
       $this->cookies[$matches[1]] = $matches[2];
     } else if (preg_match('/^Content-Type: ?([^;]*);? ?(boundary=(.*)|( ?))$/i', $header, $matches)) {
       $this->content_type = $matches[1];
       $this->content_multipart_boundary = $matches[3];
     } else if (preg_match('/^RETS-Challenge: ?.*scheme=\"SAFEMLS\".* serverinfo=\"(.*)\"/i', $header, $matches)) {
       $this->safemls_serverinfo = $matches[1];
     } else if (preg_match('/^([A-Z-]*): ?(.*)$/i', $header, $matches)) {
       $header_key = $matches[1];
       $header_value = $matches[2];
       $this->headers[$header_key] = $header_value;
     }    
     return strlen($header);
    }
    
    #------------------------------------------------------------------------------------
    # Procedure: GenerateUAHeader
    #
    # Purpose:   Create the RETS-UA-Authorization Header
    #
    # Input:     $request_id: An optional request identifier defined by the client
    #
    # Returns:   None
    #
    # Note:      This is a private function that calculates the RETS-UA-Authorization key.
    #            For more information, see the RETS Specification. Request IDs are not
    #            required by the server, and if a client is not using them, this function
    #            does not need to be called on a per transaction basis (in which case
    #            it would make sense to trigger the calculation off the change of a
    #            session_id).
    #------------------------------------------------------------------------------------
      private function GenerateUAHeader($request_id)
      {
        $a1 = "$this->useragent:$this->useragent_password";
        $a1_md5 = md5($a1);
        
        $session_id = "";
        if (array_key_exists("RETS-Session-ID", $this->cookies)) {
          $session_id = $this->cookies["RETS-Session-ID"];
        }
     
        $a2 = "$a1_md5:$request_id:$session_id:$this->rets_version";
        $this->rets_ua_authorization = md5($a2);
      }
    
    #------------------------------------------------------------------------------------
    # Procedure: ParseRetsSearchResponse
    #
    # Purpose:   Parses data from a RETS Search response and loads a pre-existing array
    #
    # Input:     $response: RETS Response
    #            $array: Data array
    #
    # Returns:   Returns the RETS data in an array.
    #
    #------------------------------------------------------------------------------------
      public function ParseRetsSearchResponse($response,&$data) {
        $columns=array();
        $xml = new XMLReader();
        $xml->XML($response);
        $nRec = sizeof($data);
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
            $data[$nRec]=$dataArray;
            $nRec++;
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
      }
    
    #------------------------------------------------------------------------------------
    # Procedure: GetObjectParts
    #
    # Purpose:   Homongenizes GetObject response so all objects are available in an array
    #
    # Input:     None
    #
    # Returns:   None
    #
    # Note:      The RETS Server can return images in two ways. If there is a single image,
    #            it is returned as a raw jpeg stream. If there are multiple images, the 
    #            response is MIME-encoded. This private function handles both cases and
    #            loads internal data structures in a standardized way. 
    #------------------------------------------------------------------------------------
      # Create private _parts attribute from current _content
      private function GetObjectParts()
      {
        $this->content_parts = array();
        if (preg_match('/^multipart\//', $this->content_type)) {
          # Multiple images that are MIME-encoded 
          if ($this->content_multipart_boundary!="") {
            $parts = explode("--".$this->content_multipart_boundary, $this->content);
            $i=0;
            foreach($parts as $part) {
              $this->content_parts[$i] = array();
              $header_block="";
              $body_block="";
              if (preg_match("/^(.*?)\r?\n\r?\n(.*)/s", $part, $matches)) {
                $header_block=$matches[1];
                $body_block=$matches[2];
              }
    
              #parse out the header information
              $header_lines = preg_split("/(\r\n|\r|\n)/", $header_block);
              foreach ($header_lines as $line) {
                if (preg_match('/^([A-Z-]*) ?: ?([A-Z0-9\/]*$)/i', $line, $matches)) {
                  # capture MIME header
                  $key = $matches[1];
                  $value = $matches[2];
                  $this->content_parts[$i][$key]=$value;
                }
              }
    
              if (array_key_exists("Content-ID", $this->content_parts[$i])) {
                $this->content_parts[$i]['Object']=$body_block;
                $i++;
              } else {
                unset($this->content_parts[$i]);
              }
            }
          }
        } else {
          # Single image case
          $this->content_parts[0] = array();
          if (array_key_exists("Content-ID", $this->headers)) {
            $this->content_parts[0]["Content-ID"]=$this->headers["Content-ID"];
          #} else {
          #  throw new Exception("Error: Can't find Content-ID for image object.");
          }
          if (array_key_exists("Object-ID", $this->headers)) {
            $this->content_parts[0]["Object-ID"]=$this->headers["Object-ID"];
          #} else {
          #  throw new Exception("Error: Can't find Object-ID for image object.");
          }
          if (!(preg_match('/No Object Found/', $this->content))) {
            $this->content_parts[0]["Object"]=$this->content;
          }
        }
      }
    }
?>