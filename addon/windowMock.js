class WindowMock {
  constructor() {
    this.location = {
      search: "?host=https://salesforce.com",
      href: "https://salesforce.com"
    };
    this.result = {style: {}};
    this.page = {src: ""};
  }
  addEventListener(str, fn) {
    if (str == "load") {
      fn();
    }
  }
}
if (global && global.window == undefined) {
  //ELSE : const { window } = new JSDOM(``, { runScripts: "outside-only" });
  global.window = new WindowMock;
  global.addEventListener = global.window.addEventListener;
  global.location = global.window.location;
}
