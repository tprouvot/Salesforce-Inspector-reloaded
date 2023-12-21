import * as https from 'https';
import { URL } from 'node:url';
import { JSDOM }  from "jsdom";


class XMLHttpRequestMock {
    constructor() {
      this.responseType = "text";
      this.readyState = this.UNSENT;
      this.onreadystatechange = null;
      this.status = null;
      this.statusText = null;
      this.response = null;
      this.options = {headers: {}};

      //constance
      this.UNSENT = 0;
      this.OPENED = 1;
      this.HEADERS_RECEIVED = 2;
      this.LOADING = 3;
      this.DONE = 4;

    }
  
    open(method, url, async, user, password) {
      this.abort();
      const myURL = new URL(url); 
        this.options = {
            "method": method,
            "port": 443,
            "hostname": myURL.hostname,
            "path": myURL.pathname
          };
      
          setState(this.OPENED);
    }
    setState(state){
      if (state == this.LOADING || this.readyState !== state) {
        this.readyState = state;
        if (settings.async || this.readyState < this.OPENED || this.readyState === this.DONE) {
          if (typeof this.onreadystatechange === "function") {
            this.onreadystatechange();
          }
        }
      }
    }

    setRequestHeader(header, value){
        this.options.headers[header] = this.options.headers[header] ? this.options.headers[header] + ', ' + value : value;
    }
    
    abort() {
      if (this.req) {
        this.req.destroy();
      }
      this.options.headers = {};
      this.status = 0;
      this.statusText = "";
    }
    send(body){
      if (this.readyState !== this.OPENED) {
        throw new Error("INVALID_STATE_ERR: connection must be opened before send() is called");
      }
      if (!this.options.headers['Content-Type']) {
        this.options.headers['Content-Type'] = "text/plain;charset=UTF-8";
      }
      this.options.headers['Content-Length'] = body.length

      this.req = https.request(this.options, (res) => {
        this.response = '';
        res.on('data', (chunk) => { this.response += chunk; });
        res.on('end', () => {
          if (this.responseType == "json") {
            this.response = JSON.parse(this.response);
          } else if (this.responseType == "document") {
            this.response = (new JSDOM(this.response)).window.document;
          }
          resolve({hostname: process.env.SF_INSTANCE_URL, key: this.sessionId});
        })
      });
      req.on('error', (e) => {
        this.status = 0;
        this.statusText = e;
        this.setState(this.DONE);
      });
      if (body){
        req.write(body);
      }
      req.end();
      //TODO if responseType = "json" => response = JSON.parse(response);
    }

  }
  if (global && global.XMLHttpRequest == undefined) {
    global.XMLHttpRequest = XMLHttpRequestMock;
  }