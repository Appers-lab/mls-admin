
require('dotenv').config()
const axios = require("axios");

const apiKey = process.env.API_KEY_GOOGLE_GEOCODER;

module.exports = async function (addrStr) {

    let addressEncoded = encodeURIComponent(addrStr);

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${addressEncoded}&key=${apiKey}`;

    const res = await axios.get(url);

    if (res.status !== 200 || !res.data) {
        return {success:false, code:"err-connection-error"};
    }
    else if (!res.data.results || !res.data.results.length) {
        return {success:false, code:"err-address-not-found"};
    }

    else if (res.data.results.length > 1) {
        return {success:false, code:"err-multi-option"};
    }

    return {
        success: true,
        lat: res.data.results[0].geometry.location.lat,
        long: res.data.results[0].geometry.location.lng
    };
}