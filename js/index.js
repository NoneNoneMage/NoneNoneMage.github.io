function getInsAccess() {
    window.location.href="https://api.instagram.com/oauth/authorize?client_id=738993563306475&redirect_uri=https://nonenonemage.github.io/&scope=user_profile,user_media&response_type=code"
}

function getQueryStringValue(name) {
    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
        results = regex.exec(location.search);
    return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}

function getAccessToken(code,succ,error){
    var data = {
        'client_id':'738993563306475',
        'client_secret':'e843acefa8dd7a4cbfdf6ec243db1105',
        'redirect_uri':'https://nonenonemage.github.io/',
        'grant_type':'authorization_code',
        'code':code
    }
    printEvent('getAccessToken POST', data);

    $.ajax({
        type: 'POST',
        url: "https://api.instagram.com/oauth/access_token",
        data: data,
        success: (result)=>{
            succ(result);
        },
        error:(err)=>{
            error(err)
        }
    });
}

function printEvent(handler, event) {
    $('#printContainer pre').append(handler + ': ' + JSON.stringify(event, null, 4) + '\n\n');
    $('#printContainer').scrollTop($('#printContainer')[0].scrollHeight);
}

$(function() {
    var code = getQueryStringValue("code");
    if(code != undefined && code != ""){
        getAccessToken(code,function (result) {
            $('#btnAccess').hide();
            $('#apiList').removeClass('hide').show();
            printEvent('getAccessToken RESP', result);
        },function (err) {
            printEvent('getAccessToken Error:' , err);
        })
    }
});