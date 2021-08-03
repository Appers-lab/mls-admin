//const DATA_PATH = '../data';
const DATA_PATH = './data';
const fs = require("fs");
const RETS = require("./rets-client");

class DataFetcher {
    constructor() {
    }

    async fetch(fetch_id, retsClass, lastTranDate, limit=null, exclude_no_photos = true) {

        console.log(`Fetching class ${retsClass} ... \n`);
    
        let name_map = {
            'rd': 'RD_1',
            'ra': 'RA_2',
            'ld': 'LD_4'
        };
    
        let fetch_path = DATA_PATH + `/fetch-${fetch_id}`; 
        let filepath = `${fetch_path}/${retsClass}.json`;
        let mediapath = DATA_PATH + `/photos-${retsClass}`;
    
        if (!fs.existsSync(DATA_PATH)) {
            fs.mkdirSync(DATA_PATH);
        }
        if (!fs.existsSync(fetch_path)) {
            fs.mkdirSync(fetch_path);
        }
        if (!fs.existsSync(mediapath)) {
            fs.mkdirSync(mediapath);
        }    

        
        // TODO: take into account $lastTranDate
        let count = await rets.CreateDataFile('Property', name_map[retsClass],'(L_Status=|1_0),(L_UpdateDate=2021-01-09T19:35:00-)', null, limit, filepath, mediapath, exclude_no_photos);
    
        //$count = $rets->CreateDataFile('Property',$name_map[retsClass],'(L_UpdateDate=2021-02-20T19:35:00-)',null,$limit, $filepath, $mediapath, $exclude_no_photos);
    
        console.log(`\n\n${count} Records fetched for class ${retsClass}!\n\n`);
    }   
}

rets = new RETS();
        
rets.url='http://reb-stage.apps.retsiq.com/contactstageres/rets/login';
rets.user='RETSALANMA';
rets.password='295003309';
rets.useragent='CMAZilla/4.00';
rets.useragent_password='1234';
rets.Login().then(async () => {
    dataFetcher = new DataFetcher();
    await dataFetcher.fetch(2, 'rd', '', 100, false);
    await dataFetcher.fetch(2, 'ra', '', 100, false);
    await dataFetcher.fetch(2, 'ld', '', 100, false);
});