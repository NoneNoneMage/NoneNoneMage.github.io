function getInsAccess() {
    window.location.href="https://api.instagram.com/oauth/authorize?client_id=738993563306475&redirect_uri=https://nonenonemage.github.io/&scope=user_profile,user_media&response_type=code"
}

function getQueryStringValue(name) {
    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
        results = regex.exec(location.search);
    return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}

function getAccessToken(code,succ){
    var data = {
        'client_id':'738993563306475',
        'client_secret':'e843acefa8dd7a4cbfdf6ec243db1105',
        'redirect_uri':'https://nonenonemage.github.io/',
        'grant_type':'authorization_code',
        'code':code
    }
    console.log("POST:" + JSON.stringify(data));
    $.post("https://api.instagram.com/oauth/access_token",data,function(result){
        succ(result);
    });
}

$(function() {
    var code = getQueryStringValue("code");
    if(code != undefined && code != ""){
        getAccessToken(code,function (result) {
            console.log('RESP:' + JSON.stringify(result))
        })
    }
});