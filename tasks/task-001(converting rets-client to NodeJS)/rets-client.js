const axios = require('axios');
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

                console.log("##################################################################################\n");
                console.log(response);
                console.log("##################################################################################\n");
                console.log("##################################################################################\n");   
                this.SetHeader(response.headers); 
                this.content = response;
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
                let response_lines = response.data.match('\<RETS-RESPONSE\>((.|\r\n)*)\<\/RETS-RESPONSE\>')[1].split('\r\n');
        
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
    GetRequest(url, request_id="", optional_headers=[], ignore_errors=false) {
    
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
                cookie_headers = $cookie_headers + `${cookie_name}=${cookie_value}`;
            }
    
            if (cookie_headers != "") {
                optional_headers.push("Cookie: " + $cookie_headers);
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

        //redirect handle?
        //curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
        //curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);

        let request = axios(ah);
        return request;

    }
    
    //------------------------------------------------------------------------------------
    // Procedure: SetHeader
    // Callback function that's fired as cURL objects receive chunks of
    // header data from the server.  Since we don't need to do anything
    // with the headers for this application, this callback function
    // just returns the length of the data it received.
    //------------------------------------------------------------------------------------
    SetHeader(header) {
        //console.log(header);
        //let matches1 = header.match('/^set-cookie: ?([^=]*)=([^;]*);/i');
        //let matches2 = header.match('/^Content-Type: ?([^;]*);? ?(boundary=(.*)|( ?))$/i');
        //let matches3 = header.match('/^RETS-Challenge: ?.*scheme=\"SAFEMLS\".* serverinfo=\"(.*)\"/i');
        //let matches4 = header.match('/^([A-Z-]*): ?(.*)$/i');
        if (header["set-cookie"] != undefined) {
            this.cookies["JSESSIONID"] = header["set-cookie"][1].match('\=(.*?)\;')[1];
            this.cookies["RETS-Session-ID"] = header["set-cookie"][2].match('\=(.*?)\;')[1];
        } else if (header["Content-Type"] != undefined) {
            //this.content_type = matches2[1];
            //this.content_multipart_boundary = matches2[3];
        } else if (header["RETS-Challenge"] != undefined) {
            //this.safemls_serverinfo = matches3[1];
        } else if (header["nothing"] != undefined) {
            //let header_key = matches4[1];
            //let header_value = matches4[2];
            //this.headers[header_key] = header_value;
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
}

rets = new RETS();

rets.url='http://reb-stage.apps.retsiq.com/contactstageres/rets/login';
rets.user='RETSALANMA';
rets.password='295003309';
rets.useragent='CMAZilla/4.00';
rets.useragent_password='1234';
response=rets.Login();