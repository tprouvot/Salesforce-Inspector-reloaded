import * as https from 'https';
import querystring  from 'node:querystring'; 
class ChromeMock {
  constructor() {
    this.runtime = {
      getAccessToken (resolve) {
        let postData = querystring.stringify({
          grant_type : "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion : (process.env.SF_JWT_SECRET_KEY||"")
        });
        (process.env.SF_INSTANCE_URL|| "test.salesforce.com")
        let options = {
          hostname: (process.env.SF_INSTANCE_URL? process.env.SF_INSTANCE_URL.substring(8): "test.salesforce.com"),
          port: 443,
          path: "/services/oauth2/token",
          method: 'POST',
          headers: {
               'Content-Type': 'application/x-www-form-urlencoded',
               'Content-Length': postData?postData.length:0
             }
        };
        console.log("JWT:"+process.env.SF_JWT_SECRET_KEY);
        console.log("host:"+options.hostname);
        
        const req = https.request(options, (res) => {
          let rawData = '';
          res.on('data', (chunk) => { rawData += chunk; });
          res.on('end', () => {
            const parsedData = JSON.parse(rawData);
            this.sessionId = parsedData.access_token;
            resolve({hostname: process.env.SF_INSTANCE_URL, key: this.sessionId});
          })
        });
        req.on('error', (e) => {
          console.error(e);
        });
        if (postData){
          console.log("write postData:"+postData);
          req.write(postData);
        }
        req.end();
      },
      sendMessage(msg, resolve) {
        if (msg.message == "getSession") {
          if (this.sessionId) {
            resolve({hostname: process.env.SF_INSTANCE_URL, key: this.sessionId});
          } else {
            this.getAccessToken(resolve);
          }

          //TODO get access token and store it
          
        } else if (msg.message == "getSfHost") {
          resolve(msg);
        } else {
          resolve(msg);
        }
      },
      onMessage: {
        addListener(fn){
          fn();
        }
      },
      cookies: {
        getAll(obj, fn) {
          fn({value: "MyOrgId!", domain: "salesforce.com"});
        },
        get(obj, fn) {
          fn();
        }
      },
      i18n: {
        getMessage(param) {
          return param;
        }
      }
    };
    this.result = {style: {}};
  }
  addEventListener(str, fn) {
    if (str == "load") {
      fn();
    }
  }
}
if (global && global.chrome == undefined) {
  global.chrome = new ChromeMock;
}

