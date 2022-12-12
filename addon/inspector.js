export let apiVersion = "56.0";
export let sfConn = {

  async getSession(sfHost) {
    let paramKey = "access_token";
    let message = await new Promise(resolve =>
      chrome.runtime.sendMessage({ message: "getSession", sfHost }, resolve));
    if (message) {
      this.instanceHostname = message.hostname;
      this.sessionId = message.key;
      if (window.location.href.includes(paramKey)) {
        let url = new URL(window.location.href);
        let access = url.hash.split("&")[0].split(paramKey + "=")[1];
        access = decodeURI(access);

        if (access) {
          this.sessionId = access;
          localStorage.setItem(sfHost + "_" + paramKey, access);
        }
      } else if (localStorage.getItem(sfHost + "_" + paramKey) != null) {
        let data = localStorage.getItem(sfHost + "_" + paramKey);
        this.sessionId = data;
      }
      let isSandbox = "isSandbox";
      if (localStorage.getItem(sfHost + "_" + isSandbox) == null) {
        sfConn.rest("/services/data/v" + apiVersion + "/query/?q=SELECT+IsSandbox+FROM+Organization").then(res => {
          localStorage.setItem(sfHost + "_" + isSandbox, res.records[0].IsSandbox);
        });
      }
    }
  },

  async rest(url, { logErrors = true, method = "GET", api = "normal", body = undefined, bodyType = "json", headers = {}, progressHandler = null } = {}) {
    if (!this.instanceHostname || !this.sessionId) {
      throw new Error("Session not found");
    }

    let xhr = new XMLHttpRequest();
    url += (url.includes("?") ? "&" : "?") + "cache=" + Math.random();
    xhr.open(method, "https://" + this.instanceHostname + url, true);

    xhr.setRequestHeader("Accept", "application/json; charset=UTF-8");

    if (api == "bulk") {
      xhr.setRequestHeader("X-SFDC-Session", this.sessionId);
    } else if (api == "normal") {
      xhr.setRequestHeader("Authorization", "Bearer " + this.sessionId);
    } else {
      throw new Error("Unknown api");
    }

    if (body !== undefined) {
      if (bodyType == "json") {
        body = JSON.stringify(body);
        xhr.setRequestHeader("Content-Type", "application/json; charset=UTF-8");
      } else if (bodyType == "raw") {
        // Do nothing
      } else {
        throw new Error("Unknown bodyType");
      }
    }

    for (let [name, value] of Object.entries(headers)) {
      xhr.setRequestHeader(name, value);
    }

    xhr.responseType = "json";
    await new Promise((resolve, reject) => {
      if (progressHandler) {
        progressHandler.abort = () => {
          let err = new Error("The request was aborted.");
          err.name = "AbortError";
          reject(err);
          xhr.abort();
        };
      }

      xhr.onreadystatechange = () => {
        if (xhr.readyState == 4) {
          resolve();
        }
      };
      xhr.send(body);
    });
    if (xhr.status >= 200 && xhr.status < 300) {
      return xhr.response;
    } else if (xhr.status == 0) {
      if (!logErrors) { console.error("Received no response from Salesforce REST API", xhr); }
      let err = new Error();
      err.name = "SalesforceRestError";
      err.message = "Network error, offline or timeout";
      throw err;
    } else {
      if (!logErrors) { console.error("Received error response from Salesforce REST API", xhr); }
      let err = new Error();
      err.name = "SalesforceRestError";
      err.detail = xhr.response;
      try {
        err.message = err.detail.map(err => `${err.errorCode}: ${err.message}${err.fields && err.fields.length > 0 ? ` [${err.fields.join(", ")}]` : ""}`).join("\n");
      } catch (ex) {
        err.message = JSON.stringify(xhr.response);
      }
      if (!err.message) {
        err.message = "HTTP error " + xhr.status + " " + xhr.statusText;
      }
      throw err;
    }
  },

  wsdl(apiVersion, apiName) {
    let wsdl = {
      Enterprise: {
        servicePortAddress: "/services/Soap/c/" + apiVersion,
        targetNamespaces: ' xmlns="urn:enterprise.soap.sforce.com" xmlns:sf="urn:sobject.enterprise.soap.sforce.com"'
      },
      Partner: {
        servicePortAddress: "/services/Soap/u/" + apiVersion,
        targetNamespaces: ' xmlns="urn:partner.soap.sforce.com" xmlns:sf="urn:sobject.partner.soap.sforce.com"'
      },
      Apex: {
        servicePortAddress: "/services/Soap/s/" + apiVersion,
        targetNamespaces: ' xmlns="http://soap.sforce.com/2006/08/apex"'
      },
      Metadata: {
        servicePortAddress: "/services/Soap/m/" + apiVersion,
        targetNamespaces: ' xmlns="http://soap.sforce.com/2006/04/metadata"'
      },
      Tooling: {
        servicePortAddress: "/services/Soap/T/" + apiVersion,
        targetNamespaces: ' xmlns="urn:tooling.soap.sforce.com" xmlns:sf="urn:sobject.tooling.soap.sforce.com" xmlns:mns="urn:metadata.tooling.soap.sforce.com"'
      }
    };
    if (apiName) {
      wsdl = wsdl[apiName];
    }
    return wsdl;
  },

  async soap(wsdl, method, args, { headers } = {}) {
    if (!this.instanceHostname || !this.sessionId) {
      throw new Error("Session not found");
    }

    let xhr = new XMLHttpRequest();
    xhr.open("POST", "https://" + this.instanceHostname + wsdl.servicePortAddress + "?cache=" + Math.random(), true);
    xhr.setRequestHeader("Content-Type", "text/xml");
    xhr.setRequestHeader("SOAPAction", '""');

    let sessionHeader = { SessionHeader: { sessionId: this.sessionId } };
    let requestBody = XML.stringify({
      name: "soapenv:Envelope",
      attributes: ` xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"${wsdl.targetNamespaces}`,
      value: {
        "soapenv:Header": Object.assign({}, sessionHeader, headers),
        "soapenv:Body": { [method]: args }
      }
    });

    xhr.responseType = "document";
    await new Promise(resolve => {
      xhr.onreadystatechange = () => {
        if (xhr.readyState == 4) {
          resolve(xhr);
        }
      };
      xhr.send(requestBody);
    });
    if (xhr.status == 200) {
      let responseBody = xhr.response.querySelector(method + "Response");
      let parsed = XML.parse(responseBody).result;
      return parsed;
    } else {
      console.error("Received error response from Salesforce SOAP API", xhr);
      let err = new Error();
      err.name = "SalesforceSoapError";
      err.detail = xhr.response;
      try {
        err.message = xhr.response.querySelector("faultstring").textContent;
      } catch (ex) {
        err.message = "HTTP error " + xhr.status + " " + xhr.statusText;
      }
      throw err;
    }
  },

  asArray(x) {
    if (!x) return [];
    if (x instanceof Array) return x;
    return [x];
  },

};

class XML {
  static stringify({ name, attributes, value }) {
    function buildRequest(el, params) {
      if (params == null) {
        el.setAttribute("xsi:nil", "true");
      } else if (typeof params == "object") {
        for (let [key, value] of Object.entries(params)) {
          if (key == "$xsi:type") {
            el.setAttribute("xsi:type", value);
          } else if (value === undefined) {
            // ignore
          } else if (Array.isArray(value)) {
            for (let element of value) {
              let x = doc.createElement(key);
              buildRequest(x, element);
              el.appendChild(x);
            }
          } else {
            let x = doc.createElement(key);
            buildRequest(x, value);
            el.appendChild(x);
          }
        }
      } else {
        el.textContent = params;
      }
    }
    let doc = new DOMParser().parseFromString("<" + name + attributes + "/>", "text/xml");
    buildRequest(doc.documentElement, value);
    return '<?xml version="1.0" encoding="UTF-8"?>' + new XMLSerializer().serializeToString(doc).replace(/ xmlns=""/g, "");
  }

  static parse(element) {
    function parseResponse(element) {
      let str = ""; // XSD Simple Type value
      let obj = null; // XSD Complex Type value
      // If the element has child elements, it is a complex type. Otherwise we assume it is a simple type.
      if (element.getAttribute("xsi:nil") == "true") {
        return null;
      }
      let type = element.getAttribute("xsi:type");
      if (type) {
        // Salesforce never sets the xsi:type attribute on simple types. It is only used on sObjects.
        obj = {
          "$xsi:type": type
        };
      }
      for (let child = element.firstChild; child != null; child = child.nextSibling) {
        if (child instanceof CharacterData) {
          str += child.data;
        } else if (child instanceof Element) {
          if (obj == null) {
            obj = {};
          }
          let name = child.localName;
          let content = parseResponse(child);
          if (name in obj) {
            if (obj[name] instanceof Array) {
              obj[name].push(content);
            } else {
              obj[name] = [obj[name], content];
            }
          } else {
            obj[name] = content;
          }
        } else {
          throw new Error("Unknown child node type");
        }
      }
      return obj || str;
    }
    return parseResponse(element);
  }
}
