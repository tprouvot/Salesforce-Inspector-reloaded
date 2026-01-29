/* global initButton */
let args = new URLSearchParams(location.search.slice(1));
let sfHost = args.get("host");
initButton(sfHost, true);
addEventListener("message", e => {
  console.log("message received: " + JSON.stringify(e.data));
  /*if (e.data.insextLoaded) {
    parent.insextTestLoaded({getRecordId: window[0].getRecordId});
  }*/
});