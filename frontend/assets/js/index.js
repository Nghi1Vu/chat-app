$(function(){
    $(".heading-compose").click(function() {
      $(".side-two").css({
        "left": "0"
      });
    });

    $(".newMessage-back").click(function() {
      $(".side-two").css({
        "left": "-100%"
      });
    });

    fetch("/getMessages").then(data=>{
      data.status === 501?window.location.href="/":null;
      data.json().then((x)=>{
      let container=$('#conversation')
      container.append(x)
          container[0].scrollTo(0, container[0].scrollHeight);
      })
    })
})