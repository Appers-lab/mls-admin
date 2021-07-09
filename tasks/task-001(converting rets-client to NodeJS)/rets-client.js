const axios = require('axios');
const fs = require('fs');
const md5 = require('./md5.js');

class RETS {
    constructor() {
        this.url;
        this.user;
        this.password;
        this.safemls_pin;
        this.useragent;
        this.useragent_password;

        this.rets_version = "RETS/1.7";
        this.rets_ua_authorization;

        //the following are used for parsing getobject responses
        this.content;
        this.content_type;
        this.content_multipart_boundary;
        this.content_parts;
        this.safemls_serverinfo;
        
        this.headers = {};
        this.cookies = {};
        
        this.login_info = {};
        this.root_url;
    
        // capbability_urls stores the URLs for the various transaction types
        this.capability_urls = {
        'Login': null,
        'Logout': null,
        'Search': null,
        'GetMetadata': null,
        'GetObject': null,
        'ChangePassword': null
        };

        // axios handler
        this.ah = null;

        this.keyfield = "L_ListingID";
        this.batchsize = 500;
    }

    //------------------------------------------------------------------------------------
    // Procedure: Login
    //
    // Purpose:   Login to the RETS Server
    //
    // Input:     None
    //
    // Returns:   Returns true if successful
    //
    // Note:      None
    //------------------------------------------------------------------------------------
    async Login() {
        let login_success = false;
        let response;
    
        if (this.safemls_pin == undefined) {
            console.log("Logging in ...\n");
            try {
                response = await this.GetRequest(this.url);
                login_success = true;
            } catch(err) {
                login_success = false;
                console.log(err);
            }
        } else {
            console.log("Logging in with SafeMLS ...\n");
            response = await this.GetRequest(this.url, "", `RETS-Challenge: scheme="SAFEMLS" user="${this.user}"`, true);
            let response_password = this.password + this.safemls_pin;
    
            try {
                response = await this.GetRequest(this.url, "", `RETS-Challenge: scheme="SAFEMLS" response="${response_password}" challenge="safemls" serverinfo="${this.safemls_serverinfo}"`, false);
                login_success = true;
            } catch(err) {
                login_success = false;
            }
        }
        
        if (login_success) {
            console.log("parse capability urls and store\n");
            try {
                let response_lines = response.match(/<RETS-RESPONSE>((.|\r\n)*)<\/RETS-RESPONSE>/)[1].split('\r\n');
        
                for (let line of response_lines)
                {
                    if(!line.includes("=")) {
                        continue;
                    } else {
                        let [key,value] = line.split("=");

                        if(key in this.capability_urls) {
                            this.capability_urls[key] = "http://reb-stage.apps.retsiq.com" + value;
                        } else {
                            this.login_info[key] = value;
                        }
                    }
                }
            } catch (err) {
                login_success = false;
                console.log(err);      
            }
        }
        return login_success;
    }
    
    //------------------------------------------------------------------------------------
    // Procedure: GetRequest
    //
    // Purpose:   Contains common request handling for all RETS Server requests
    //
    // Input:     $url: URL for RETS request
    //            $request_id: An optional request identifier defined by the client
    //            $ignore_errors: A flag indicating that HTTP errors should be ignored
    //
    // Returns:   Returns the raw response from the RETS Server
    //
    // Note:      This method currently only supports HTTP Basic Authentication.
    //            It would need to be enhanced to handle HTTP Digest Authentication.
    //------------------------------------------------------------------------------------
    async GetRequest(url, request_id="", optional_headers=[], ignore_errors=false) {
    
        this.GenerateUAHeader(request_id);
        optional_headers.push('Accept: */*');
        let cookie_headers = "";
        if (this.safemls_pin==undefined && Object.keys(this.cookies).length==0) {
            // php comments
            // no session cookies exist, so create a session using HTTP Basic Authentication
            // $auth = base64_encode("$this->user:$this->password");
            // array_push($optional_headers, 'Authorization: Basic ' . $auth);
        } else {
            // add any existing cookies to the request
            for (const [cookie_name, cookie_value] of Object.entries(this.cookies)) {
                if (cookie_headers != "") {
                    cookie_headers = cookie_headers + "; ";
                }
                cookie_headers = cookie_headers + `${cookie_name}=${cookie_value}`;
            }
    
            if (cookie_headers != "") {
                optional_headers.push("Cookie: " + cookie_headers);
            }
        }    
    
        let ah = this.ah;
        if (ah==null) {
            ah = {
                method: 'post',
                headers: {}
            };
            this.ah = ah;
        }

        if (url.includes("login")) { 
            //clogin and get cookie
            ah["auth"] = {
                username: this.user,
                password: this.password
            };
        } else { 
            //cuse cookie for authentication instead of username and password
            ah["headers"]["Cookie"] = cookie_headers;
        }
    
        if (this.rets_ua_authorization!="") {
            ah["headers"]["RETS-UA-Authorization"] = `Digest ${this.rets_ua_authorization}`;
        }        
        ah["headers"]["RETS-Version"] = this.rets_version;
        ah["headers"]["User-Agent"] = this.useragent;
        
        let parts = url.split("?");
        let postdata = null;
        url = parts[0];
        if(parts.length > 1)
        {
            postdata = parts.slice(1,parts.length).join("?");
            ah["data"] = postdata;    
        }
        ah["url"] = url;

        ah["timeout"] = 0;

        ah["responseEncoding"] = "binary";
        
        //redirect handle?
        //curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
        //curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);

        let response = await axios(ah);

        for (const [key,values] of Object.entries(response.headers)) {
            if(Array.isArray(values)) {
                for (const value of values)
                {
                    this.SetHeader(`${key}: ${value}`);
                }    
            }
            else {
                this.SetHeader(`${key}: ${values}`);                
            }
        }

        this.content = response.data;
        //console.log("##################################################################################\n");
        //console.log(response);
        //console.log("##################################################################################\n");
        //console.log("##################################################################################\n");

        return response.data;
    }
    
    //------------------------------------------------------------------------------------
    // Procedure: SetHeader
    // Callback function that's fired as cURL objects receive chunks of
    // header data from the server.  Since we don't need to do anything
    // with the headers for this application, this callback function
    // just returns the length of the data it received.
    //------------------------------------------------------------------------------------
    SetHeader(header) {
        let matches = header.match(/^set-cookie: ?([^=]*)=([^;]*);/i);
        if (matches) {
            this.cookies[matches[1]] = matches[2];
        } else {
            matches = header.match(/^Content-Type: ?([^;]*);? ?(boundary=(.*)|( ?))$/i);
            if (matches) {
                this.content_type = matches[1];
                this.content_multipart_boundary = matches[3];
            } else {
                matches = header.match(/^RETS-Challenge: ?.*scheme=\"SAFEMLS\".* serverinfo=\"(.*)\"/i);
                if (matches) {
                    this.safemls_serverinfo = matches[1];
                } else {
                    matches = header.match(/^([A-Z-]*): ?(.*)$/i);
                    if (matches) {
                        let header_key = matches[1];
                        let header_value = matches[2];
                        this.headers[header_key] = header_value;
                    }
                }
            }
        }
        return header.length;
    }

    //------------------------------------------------------------------------------------
    // Procedure: GenerateUAHeader
    //
    // Purpose:   Create the RETS-UA-Authorization Header
    //
    // Input:     $request_id: An optional request identifier defined by the client
    //
    // Returns:   None
    //
    // Note:      This is a private function that calculates the RETS-UA-Authorization key.
    //            For more information, see the RETS Specification. Request IDs are not
    //            required by the server, and if a client is not using them, this function
    //            does not need to be called on a per transaction basis (in which case
    //            it would make sense to trigger the calculation off the change of a
    //            session_id).
    //------------------------------------------------------------------------------------
    GenerateUAHeader(request_id)
    {
        let a1 = `${this.useragent}:${this.useragent_password}`;
        let a1_md5 = md5.MD5(a1);
        
        let session_id = "";
        if (this.cookies["RETS-Session-ID"]) {
            session_id = this.cookies["RETS-Session-ID"];
        }
        
        let a2 = `${a1_md5}:${request_id}:${session_id}:${this.rets_version}`;
        this.rets_ua_authorization = md5.MD5(a2);
    }

    //----------------------------------------------------------------------//

    //------------------------------------------------------------------------------------
    // Procedure: CreateDataFile
    //
    // Purpose:   Retrieves records using full key download and write to file
    //
    // Input:     $resource: RETS Resource
    //            $retsClass: RETS Class
    //            $query: RETS DMQL query
    //            $selectfields: Comma separated list of fields to select
    //            $maxrows: Maximum number of rows of data to retrieve
    //            $filepath: Local path to save data to
    //
    // Returns:   Returns the numeric count of records that match the criteria of the DMQL 
    //            query.
    //
    // Note:      This function parses the count out of the RETS Response. For details on 
    //            DMQL, please set the RETS Specification.
    //------------------------------------------------------------------------------------
    async CreateDataFile(resource,retsClass,query,selectfields,maxrows,outputfile, media_path="", drop_no_photos=true) {
        
        let numkeys = -1;
        
        let keys = await this.GetDataKeysArray(resource, retsClass, query, maxrows);
        let total_count = 0;

        if (keys!=null) {
            numkeys = keys.length;
            console.log(`Found ${numkeys} keys\n`);
            if (numkeys > 0) {
                console.log(`Exporting records to ${outputfile}\n`);
                
                let f = fs.openSync(outputfile, 'w');
                fs.writeSync(f, "[");

                let flag = true;
                let processed = 0;

                for (let i=0; i < numkeys; i = i + this.batchsize) {
                    let response = await this.GetDataArrayFromKeyData(resource,retsClass,selectfields,keys,i,this.batchsize);

                    if (response != null) {                        
                                                
                        for (const [key, value] of Object.entries(response)) {
                            
                            processed++;
                            let count = 1;
                            // getting photos
                            if (media_path) {
                                let sysid = value[this.keyfield];
                                console.log(`\r[Added: ${total_count}] - Processing ${processed}/${numkeys} -- Getting photos for prop ${sysid} ... `);
                                count = await this.GetPhoto("Property",`${sysid}:*`, media_path);
                                
                                console.log(`\r${count} photo(s)`);
                            }

                            if (!drop_no_photos || count ) {
                                if (!flag) {
                                    fs.writeSync(f, ",");
                                }                                 
                                flag = false;
                                let dataline = JSON.stringify(value);
                                fs.writeSync(f, dataline);
                                total_count++;
                            } else {
                                //console.print("NO photos!! SKIPPED\n");
                            }
                        }
                    }
                }

                fs.writeSync(f, "]");
                fs.close(f);
            }
        }
        return total_count;
    }

    //------------------------------------------------------------------------------------
    // Procedure: GetDataKeysArray
    //
    // Purpose:   Retrieves Data Keys from the RETS Server
    //
    // Input:     $resource: RETS Resource
    //            $retsClass: RETS Class
    //            $query: RETS DMQL query
    //            $maxrows: Maximum number of rows of data to retrieve
    //
    // Returns:   Returns RETS key data in an array.
    //
    // Note:      This function parses through a RETS Search response and builds
    //            an array out of the results. For details on DMQL, please set the 
    //            RETS Specification. 
    //------------------------------------------------------------------------------------
    async GetDataKeysArray(resource,retsClass,query,maxrows) {
        //console.print("Getting Keys ...\n");
        // get the keys
        let keyresponse = await this.GetDataArray(resource,retsClass,query,this.keyfield,maxrows);
        return keyresponse;
    }

    //------------------------------------------------------------------------------------
    // Procedure: GetDataArray
    //
    // Purpose:   Retrieves Data from the RETS Server
    //
    // Input:     $resource: RETS Resource
    //            $retsClass: RETS Class
    //            $query: RETS DMQL query
    //            $selectfields: Comma separated list of fields to select
    //            $maxrows: Maximum number of rows of data to retrieve
    //
    // Returns:   Returns the RETS data in an array.
    //
    // Note:      This function parses through a RETS Search response and builds
    //            an array out of the results. For details on DMQL, please set the 
    //            RETS Specification. 
    //------------------------------------------------------------------------------------
    async GetDataArray(resource,retsClass,query,selectfields,maxrows) {
        let response = await this.GetData(resource,retsClass,query,selectfields,maxrows); 
        let data = [];
        this.ParseRetsSearchResponse(response,data);
        return data;
        //return response;
    }

    //------------------------------------------------------------------------------------
    // Procedure: GetData
    //
    // Purpose:   Retrieves data from the RETS Server
    //
    // Input:     $resource: RETS Resource
    //            $retsClass: RETS Class
    //            $query: RETS DMQL query
    //            $selectfields: Comma separated list of fields to select
    //            $maxrows: Maximum number of rows of data to retrieve
    //
    // Returns:   Returns the raw response from the RETS Server
    //
    // Note:      This function shows how to retrieve the metadata but does
    //            parse the output in any way. For details on DMQL, please set the
    //            RETS Specification.
    //------------------------------------------------------------------------------------
    async GetData(resource,retsClass,query,selectfields,maxrows) {
        //console.log("Getting Data ...\n");
        let request_string = this.capability_urls['Search'] + `?Format=COMPACT&QueryType=DMQL2&Count=1&SearchType=${resource}&Class=${retsClass}&Query=${query}`;
        if (selectfields != null) {
            request_string = request_string + "&Select=" + selectfields;
        }
        if (maxrows!=null) {
            request_string = request_string + "&Limit=" + maxrows;
        }
        let response = await this.GetRequest(request_string);
        return response;
    }

    //------------------------------------------------------------------------------------
    // Procedure: ParseRetsSearchResponse
    //
    // Purpose:   Parses data from a RETS Search response and loads a pre-existing array
    //
    // Input:     $response: RETS Response
    //            $array: Data array
    //
    // Returns:   Returns the RETS data in an array.
    //
    //------------------------------------------------------------------------------------
    ParseRetsSearchResponse(response,data) {
        let columns= [];

        let colline = response.match(/<COLUMNS>(.*)<\/COLUMNS>/)[1];
        colline = colline.replace(/^[^\t]*\t/, "");
        colline = colline.replace(/\t[^\t]*$/, "");

        let col = 0;
        for(let systemname of colline.split(/\t/))
        {
            columns[col] = systemname;
            col++;
        }

        let datlines = [...response.matchAll(/<DATA>([^<]*)<\/DATA>/g)].map(m => m[1]);  
        datlines = datlines.map(m => m.replace(/^[^\t]*\t/, ""));
        datlines = datlines.map(m => m.replace(/\t[^\t]*$/, ""));

        for(let datline of datlines) {
            col = 0;
            let dataArray = {};
            for(let datvalue of datline.split(/\t/))
            {
                dataArray[columns[col]] = datvalue;
                col++;
            }
            data[data.length] = dataArray;
        }
    }

    //------------------------------------------------------------------------------------
    // Procedure: GetDataArrayFromKeyData
    //
    // Purpose:   Retrieves Data from the RETS Server
    //
    // Input:     $resource: RETS Resource
    //            $retsClass: RETS Class
    //            $query: RETS DMQL query
    //            $selectfields: Comma separated list of fields to select
    //            $keydata: Key Data array from GetDataKeysArray request
    //            $index: Start index
    //            $numrecs: Number of records to return (<200)
    //
    // Returns:   Returns the RETS data in an array.
    //
    // Note:      This function parses through a RETS Search response and builds
    //            an array out of the results. For details on DMQL, please set the 
    //            RETS Specification. 
    //------------------------------------------------------------------------------------
    async GetDataArrayFromKeyData(resource,retsClass,selectfields,keydata,index,numrecs) {
        console.log(`\rGetting Data from Key Data ... ${numrecs} records starting at ${index}`);

        // loop through keys
        let data = [];
        let keystr = "";
        let index_start = index;
        let index_stop = index_start + numrecs;
        if (index_stop > keydata.length) {
            index_stop = keydata.length;
        }
        for (let i= index; i < index_stop; i++) {
            if (keystr.length >0) {
                keystr = keystr + ",";
            }
            keystr = keystr + keydata[i][this.keyfield];
            if ( ((i+1) % numrecs) == 0 || i == (keydata.length -1))  {
                let keyquery = `(${this.keyfield}=${keystr})`;
                let response = await this.GetData(resource,retsClass,keyquery,selectfields,null);
                this.ParseRetsSearchResponse(response,data);
                keystr = "";
            }
        }
        return data;
    }

    //------------------------------------------------------------------------------------
    // Procedure: GetPhoto
    //
    // Purpose:   Retrieves images from the RETS Server
    //
    // Input:     $resource: RETS Resource
    //            $id: RETS Photo ID (see RETS Specification for details)
    //            $filepath: Local path to save images to
    //
    // Returns:   Returns true if successful.
    //
    // Note:      None
    //------------------------------------------------------------------------------------
    async GetPhoto(resource,id,filepath) {
        //console.log("Getting Photos ...\n");
        let numphotos = 0;

        let request_string = this.capability_urls['GetObject'] + `?Location=0&Type=Photo&Resource=${resource}&ID=${id}`;
        let response = await this.GetRequest(request_string);

        this.GetObjectParts();
        //console.log("Extracting " + this.content_parts.length + " images ...\n");

        //loop through objects and create files
        let i = 0;
        for (let part of this.content_parts) {
            let part_filepath = filepath + "/" + part["Content-ID"] + "_" + part["Object-ID"] + ".jpg";
            
            if (part["Object"].includes('ReplyText="Object Unavailable') !== false || 
                part["Object"].includes('ReplyText="No Object Found') !== false) {
                //print("THIS IS the invalid ==> $part[Object]\n\n");
                continue;
            }

            let fh = fs.openSync(part_filepath, 'w');
            var buf = new Buffer.from(part["Object"], 'binary');
            fs.writeSync(fh, buf);
            fs.close(fh);

            numphotos++;
        }
        return numphotos;
    }

    //------------------------------------------------------------------------------------
    // Procedure: GetObjectParts
    //
    // Purpose:   Homongenizes GetObject response so all objects are available in an array
    //
    // Input:     None
    //
    // Returns:   None
    //
    // Note:      The RETS Server can return images in two ways. If there is a single image,
    //            it is returned as a raw jpeg stream. If there are multiple images, the 
    //            response is MIME-encoded. This private function handles both cases and
    //            loads internal data structures in a standardized way. 
    //------------------------------------------------------------------------------------
    // Create private _parts attribute from current _content
    GetObjectParts() {
        this.content_parts = [];
        if (this.content_type.match(/^multipart\//)) {
            // Multiple images that are MIME-encoded 
            if (this.content_multipart_boundary != "") {
                let parts = this.content.split("--"+this.content_multipart_boundary);
                            //explode("--".$this->content_multipart_boundary, $this->content);
                let i = 0;
                for (let part of parts) {
                    this.content_parts[i] = {};
                    let header_block = "";
                    let body_block = "";

                    let matches = part.match(/^(.*?)\r?\n\r?\n(.*)/s);
                    if (matches) {
                        header_block = matches[1];
                        body_block = matches[2];
                    }

                    // parse out the header information
                    let header_lines = header_block.split(/(\r\n|\r|\n)/);
                                        //preg_split("/(\r\n|\r|\n)/", $header_block);
                    for (let line of header_lines) {
                        matches = line.match(/^([A-Z-]*) ?: ?([A-Z0-9\/]*$)/i);
                        if (matches) {
                            // capture MIME header
                            let key = matches[1];
                            let value = matches[2];
                            this.content_parts[i][key]=value;
                        }
                    }

                    if("Content-ID" in this.content_parts[i]) {
                    //(array_key_exists("Content-ID", $this->content_parts[$i])) {
                        this.content_parts[i]['Object'] = body_block;
                        i++;
                    } else {
                        this.content_parts.splice(i,1);
                    }
                }
            }
        } else {
            // Single image case
            this.content_parts[0] = {};
            if("Content-ID" in this.headers) {
            //(array_key_exists("Content-ID", $this->headers)) {
                this.content_parts[0]["Content-ID"] = this.headers["Content-ID"];
            //} else {
            //  throw new Exception("Error: Can't find Content-ID for image object.");
            }
            if("Object-ID" in this.headers) {
            //(array_key_exists("Object-ID", $this->headers)) {
                this.content_parts[0]["Object-ID"] = this.headers["Object-ID"];
            //} else {
            //  throw new Exception("Error: Can't find Object-ID for image object.");
            }
            if(this.content.includes("No Object Found")) {
            // (!(preg_match('/No Object Found/', $this->content))) {
                this.content_parts[0]["Object"] = this.content;
            }
        }
    }
}

module.exports = RETS;


//------------------------------------------------------------------------//

// rets = new RETS();

// rets.url='http://reb-stage.apps.retsiq.com/contactstageres/rets/login';
// rets.user='RETSALANMA';
// rets.password='295003309';
// rets.useragent='CMAZilla/4.00';
// rets.useragent_password='1234';
// response=rets.Login();
