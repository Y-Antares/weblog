if (!!$.prototype.justifiedGallery) {
  var options = {
    rowHeight: 140,
    margins: 4,
    lastRow: "justify"
  };
  $(".article-gallery").justifiedGallery(options);
}

$(window).on('load', function(){
    
    $("#wrapper").fadeTo("slow",1);
    $("#blogtitel").fadeOut(2000);
});

$(document).ready(function() {


  $(window).on('scroll', function() {
    var banner = $(".banner")[0];
    var rect = banner.getBoundingClientRect();
    var ratio = rect.bottom / (rect.bottom - rect.top);
  
    // 调整缩放比例，增加一个缓动效果
    var z = Math.max(0.01, Math.min(1, ratio * 0.5 + 0.5)); // 调整这里的系数以改变速度
  
    $(".wrapper")[0].style.zoom = z;
    $(".wrapper")[0].style.MozTransform = "scale(" + z + ")";
  });

  $("#menu-icon, #menu-icon-tablet").click(function() {
    if ($('#menu').css('visibility') == 'hidden') {
      $('#menu').css('visibility', 'visible');
      $('#menu-icon, #menu-icon-tablet').addClass('active');

      var topDistance = $("#menu > #nav").offset().top;

      $("#menu > #nav").show();
      return false;
    } else {
      $('#menu').css('visibility', 'hidden');
      $('#menu-icon, #menu-icon-tablet').removeClass('active');

      return false;
    }
  });

  /* Shows the responsive navigation menu on mobile. */
  $("#header > #nav > ul > .icon").click(function() {
    $("#header > #nav > ul").toggleClass("responsive");
  });

  /* Controls the different versions of  the menu in blog post articles. for Desktop, tablet and mobile. */
  if ($(".post").length) {
    var menu = $("#menu");
    var nav = $("#menu > #nav");
    var menuIcon = $("#menu-icon, #menu-icon-tablet");

    /*Display the menu on hi-res laptops and desktops.*/
    if ($(document).width() >= 1440) {
      menu.show();
      menuIcon.addClass("active");
    }

    /*Display the menu if the menu icon is clicked.*/
    menuIcon.click(function() {
      if (menu.is(":hidden")) {
        menu.show();
        menuIcon.addClass("active");
      } else {
        menu.hide();
        menuIcon.removeClass("active");
      }
      return false;
    });

    /* Add a scroll listener to the menu to hide/show the navigation links. */
    if ($("#menu").length) {
      $(window).on('scroll', function() {
        var topDistance = $(window).scrollTop();

        if ($('#menu').css('visibility') != 'hidden' && 1>0) {
          $("#menu > #nav").show();
        }

        if (!$("#menu-icon").is(":visible") && topDistance < 10) {

          $("#menu-icon-tablet").show();
          $("#top-icon-tablet").hide();
        } else if (!$("#menu-icon").is(":visible") && topDistance > 10) {

          $("#menu-icon-tablet").hide();
          $("#top-icon-tablet").show();
        }
      });
    }

    /* Show mobile navigation menu after scrolling upwards, hide it again after scrolling downwards. */
    if ($("#footer-post").length) {
      var lastScrollTop = 0;
      $(window).on('scroll', function() {
        var topDistance = $(window).scrollTop();

        if (topDistance > lastScrollTop) {
          // downscroll code
          $("#footer-post").hide();
        } else {
          // upscroll code
          $("#footer-post").show();
        }
        lastScrollTop = topDistance;

        $("#nav-footer").hide();
        $("#toc-footer").hide();
        $("#share-footer").hide();

        if (topDistance < 50) {
          $("#actions-footer > ul > #top").hide();
          $("#actions-footer > ul > #menu").show();
        } else if (topDistance > 100) {
          $("#actions-footer > ul > #menu").hide();
          $("#actions-footer > ul > #top").show();
        }
      });
    }
  }
});
