jQuery.noConflict();
(function ($) {
  function _getCookie(name) {
    var arg = name + "=";
    var alen = arg.length;
    var clen = document.cookie.length;
    var i = 0;
    while (i < clen) {
      var j = i + alen;
      if (document.cookie.substring(i, j) == arg) {
        return _getCookieVal(j);
      }
      i = document.cookie.indexOf(" ", i) + 1;
      if (i == 0) break;
    }
    return null;
  }
  jQuery(window).scroll(function () {
    if (jQuery(window).scrollTop() >= 300) {
      jQuery('.style-11 .menuWrapper').addClass('is-sticky');
    } else {
      jQuery('.style-11 .menuWrapper').removeClass('is-sticky');
    }
  });

  // function _deleteCookie(name, path, domain) {
  //   if (_getCookie(name)) {
  //     document.cookie =
  //         name +
  //         "=" +
  //         (path ? "; path=" + path : "") +
  //         (domain ? "; domain=" + domain : "") +
  //         "; expires=Thu, 01-Jan-70 00:00:01 GMT";
  //   }
  // }

  function _setCookie(name, value, expires, path, domain, secure) {
    var vurl = true;
    if (path != "" && path != undefined) {
      vurl = validUrl(path);
    }
    if (jQuery.type(name) == "string" && vurl) {
      document.cookie =
        name +
        "=" +
        escape(value) +
        (expires ? "; expires=" + expires.toGMTString() : "") +
        (path ? "; path=" + path : "") +
        (domain ? "; domain=" + domain : "") +
        (secure ? "; secure" : "");
    }
  }

  function _getCookieVal(offset) {
    var endstr = document.cookie.indexOf(";", offset);
    if (endstr == -1) {
      endstr = document.cookie.length;
    }
    return unescape(document.cookie.substring(offset, endstr));
  }

  if (_getCookie("fontSize") != null) {
    var fontSize = _getCookie("fontSize");
    jQuery("body").css("font-size", fontSize + "px");
  } else {
    var fs = jQuery("body").css("font-size");
    var fontSize = fs;
    jQuery("body").css("font-size", fs);
  }

  $(".fontSizeEvent").on("fontSelected", function () {
    let fontSizeStatus = _getCookie("fontSizeStatus");

    if (fontSizeStatus == null) {
      fontSizeStatus = "normal";
    }

    let fontSizeTagElement = ($('body').hasClass('header-style-2')) ? 'button' : 'a';

    let label = $('.fontSizeEvent ' + fontSizeTagElement + '[data-event-type="' + fontSizeStatus + '"]').attr("data-label");
    let dataSelected = $('.fontSizeEvent ' + fontSizeTagElement + '[data-event-type="' + fontSizeStatus + '"]').attr("data-selected-text");

    $('.fontSizeEvent a[data-event-type="' + fontSizeStatus + '"],.fontSizeEvent button[data-event-type="' + fontSizeStatus + '"]')
      // .attr("title", label)
      .attr("aria-label", label + " - " + dataSelected)
      .attr("title", label + " - " + dataSelected)
      .addClass("link-selected");

    $('.fontSizeEvent a[data-event-type="' + fontSizeStatus + '"],.fontSizeEvent button[data-event-type="' + fontSizeStatus + '"]')
      .parent()
      .siblings()
      .each(function () {
        let label = $(this)
          .find("a,button")
          .attr("data-label");
        $(this)
          .find("a,button")
          .attr("aria-label", label)
          .attr("title", label)
          .removeClass("link-selected");
      });
  });

  $(".fontSizeEvent").trigger("fontSelected");

  $(".fontSizeEvent a,.fontSizeEvent button").on("click", function (event) {
    event.stopPropagation();
    event.preventDefault();
    let fontEvent = $(this).attr("data-event-type");

    if (fontEvent == "increase") {
      if (parseInt(fontSize) < 18) {
        fontSize = parseInt(fontSize) + 2;
        _setCookie("fontSizeStatus", "increase");
      }
    } else if (fontEvent == "decrease") {
      if (parseInt(fontSize) > 10) {
        fontSize = parseInt(fontSize) - 2;
      }
      _setCookie("fontSizeStatus", "decrease");
    } else {
      fontSize = 14;
      _setCookie("fontSizeStatus", "normal");
    }

    $(this)
      .addClass("link-selected")
      .parent()
      .siblings()
      .find("a,button")
      .removeClass("link-selected");
    _setCookie("fontSize", fontSize);
    $("body").css("font-size", fontSize + "px");
    $(".fontSizeEvent").trigger("fontSelected");
  });

  // font size increase/decrease announcement
  jQuery(document).ready(function ($) {
    let minFont = 10;
    let maxFont = 18;
    let step = 2;
    let currentFont = 14;

    function updateFontSize(newSize, announce = false) {
      $("body").css("font-size", newSize + "px");

      if (announce) {
        $("#fontSizeAnnouncer")
          .attr("aria-live", "polite")
          .text("Font size is " + newSize + " pixels");
        setTimeout(() => {
          $("#fontSizeAnnouncer").removeAttr("aria-live");
        }, 1000);
      } else {
        $("#fontSizeAnnouncer").text("").removeAttr("aria-live");
      }
    }

    function handleFontChange(type) {
      if (type === "increase" && currentFont < maxFont) {
        currentFont += step;
      } else if (type === "decrease" && currentFont > minFont) {
        currentFont -= step;
      }
      updateFontSize(currentFont, true);
      document.cookie = "fontSizeStatus=" + type;
      $(".fontSizeEvent").trigger("fontSelected");
    }

    $("#fontIncrease, #fontDecrease").on("click keydown", function (e) {
      if (e.type === "click" || e.key === "Enter" || e.key === " ") {
        let type = $(this).data("event-type");
        handleFontChange(type);
        e.preventDefault();
      }
    });
    updateFontSize(currentFont, false);
  });

  function printbody() {
    window.print();
  }


  //topbar Menu accessibility 

  jQuery('#accessibility > ul').attr('role', 'menubar')
  jQuery('#accessibility > ul > li').attr('role', 'none')
  jQuery('#accessibility > ul > li > a, #accessibility > ul > li > button').attr('role', 'menuitem').attr('tabindex', '0')
  jQuery('#accessibility > ul > li  a, #accessibility > ul > li  button').attr('tabindex', '0')
  jQuery('#accessibility > ul > li .socialIcons').attr('role', 'menu')
  jQuery('#accessibility > ul > li .socialIcons li').attr('role', 'none')
  jQuery('#accessibility > ul > li .socialIcons li a').attr('role', 'menuitem')
  jQuery('#accessibility > ul > li .goiSearch').attr('role', 'application')


  document.addEventListener('DOMContentLoaded', function () {
    const menuItems = document.querySelectorAll('#accessibilityMenu > li > a, #accessibilityMenu > li > button, #accessibilityMenu > li button.bhashini-dropdown-btn');
    let lastFocusedItem = null;

    menuItems.forEach((item, index) => {
      const submenu = item.nextElementSibling;

      const activateSubmenu = function (e) {
        const isAnchor = item.tagName.toLowerCase() === 'a';
        const hasSubmenu = submenu !== null;

        if (e.type === 'keydown' && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          lastFocusedItem = item;
          if (hasSubmenu) {
            toggleSubmenu(item, submenu);
          } else if (isAnchor && item.href) {
            window.location.href = item.href;
          }
        } else if (e.type === 'click' || e.type === 'touchend') {
          if (hasSubmenu) {
            e.preventDefault();
            toggleSubmenu(item, submenu);
          } else if (isAnchor && item.href) {
            return;
          }
        }
      };

      item.addEventListener('keydown', function (e) {
        activateSubmenu(e);


        if (e.key === 'ArrowDown') {
          if (submenu) {
            e.preventDefault();

            // Open submenu if not already open
            if (submenu.getAttribute('aria-hidden') !== 'false') {
              openSubmenu(item, submenu);
            }

            // Focus first focusable submenu item
            const focusableSelector =
              'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

            const focusableItems = Array.from(
              submenu.querySelectorAll(focusableSelector)
            ).filter(el => !el.disabled && el.offsetParent !== null);

            if (focusableItems.length > 0) {
              focusableItems[0].focus();
            }
          }
          return;
        }


        if (e.key === 'ArrowRight') {
          e.preventDefault();
          const nextIndex = (index + 1) % menuItems.length;
          menuItems[nextIndex].focus();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          const prevIndex = (index - 1 + menuItems.length) % menuItems.length;
          menuItems[prevIndex].focus();
        } else if (e.key === 'Home') {
          e.preventDefault();
          menuItems[0].focus();
        } else if (e.key === 'End') {
          e.preventDefault();
          menuItems[menuItems.length - 1].focus();
        }
      });

      item.addEventListener('click', activateSubmenu);
      item.addEventListener('touchend', activateSubmenu);

      if (submenu) {
        const focusableSelector = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

        submenu.addEventListener('keydown', function (e) {
          const focusableElements = Array.from(submenu.querySelectorAll(focusableSelector)).filter(el => !el.disabled && el.offsetParent !== null);
          if (focusableElements.length === 0) return;
          const firstElement = focusableElements[0];
          const lastElement = focusableElements[focusableElements.length - 1];

          const currentIndex = focusableElements.indexOf(document.activeElement);

          if (e.key === 'Tab') {
            if (e.shiftKey) {
              if (document.activeElement === firstElement) {
                e.preventDefault();
                lastElement.focus();
              }
            } else {
              if (document.activeElement === lastElement) {
                e.preventDefault();
                firstElement.focus();
              }
            }
          } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault();
            const next = currentIndex + 1 < focusableElements.length ? focusableElements[currentIndex + 1] : firstElement;
            next.focus();
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault();
            const prev = currentIndex - 1 >= 0 ? focusableElements[currentIndex - 1] : lastElement;
            prev.focus();
          } else if (e.key === 'Escape') {
            closeSubmenu(item, submenu);
            if (lastFocusedItem) lastFocusedItem.focus();
          }
        });

        submenu.addEventListener('focusout', function (e) {
          if (!submenu.contains(e.relatedTarget) && e.relatedTarget !== item) {
            closeSubmenu(item, submenu);
          }
        });
      }

      // item.addEventListener('focus', function () {
      //   lastFocusedItem = item;
      //   if (submenu && submenu.getAttribute('aria-hidden') === 'false') {
      //     closeSubmenu(item, submenu);
      //   }
      // });
      item.addEventListener('focus', function () {
        lastFocusedItem = item;
        // Do not auto-close here — let user control via Esc or blur
      });
    });

    document.addEventListener('click', function (e) {
      let isClickInsideMenu = false;

      menuItems.forEach(item => {
        const submenu = item.nextElementSibling;
        if (item.contains(e.target) || (submenu && submenu.contains(e.target))) {
          isClickInsideMenu = true;
        }
      });

      if (!isClickInsideMenu) {
        menuItems.forEach(item => {
          const submenu = item.nextElementSibling;
          if (submenu && submenu.getAttribute('aria-hidden') === 'false') {
            closeSubmenu(item, submenu);
          }
        });
      }
    });

    document.addEventListener('touchend', function (e) {
      let isTouchInsideMenu = false;

      menuItems.forEach(item => {
        const submenu = item.nextElementSibling;
        if (item.contains(e.target) || (submenu && submenu.contains(e.target))) {
          isTouchInsideMenu = true;
        }
      });

      if (!isTouchInsideMenu) {
        menuItems.forEach(item => {
          const submenu = item.nextElementSibling;
          if (submenu && submenu.getAttribute('aria-hidden') === 'false') {
            closeSubmenu(item, submenu);
          }
        });
      }
    });

    function toggleSubmenu(item, submenu) {
      const isOpen = submenu.getAttribute('aria-hidden') === 'false';
      if (isOpen) {
        closeSubmenu(item, submenu);
      } else {
        openSubmenu(item, submenu);
      }
    }

    function openSubmenu(item, submenu) {
      submenu.style.opacity = '1';
      submenu.style.visibility = 'visible';
      submenu.style.display = 'block';
      submenu.setAttribute('aria-hidden', 'false');
      item.setAttribute('aria-expanded', 'true');

    }

    function closeSubmenu(item, submenu) {
      submenu.style.opacity = '';
      submenu.style.visibility = '';
      submenu.style.display = '';
      submenu.setAttribute('aria-hidden', 'true');
      item.setAttribute('aria-expanded', 'false');
    }

    //By pressing ESC key close any open submenu
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        menuItems.forEach(item => {
          const submenu = item.nextElementSibling;
          if (submenu && submenu.getAttribute('aria-hidden') === 'false') {
            closeSubmenu(item, submenu);
            if (item) item.focus();
          }
        });
      }
    });

  });





  // Retain the original jQuery code for .skipContent
  jQuery("a.skipContent").bind("click", function (event) {
    var $anchor = jQuery(this);
    jQuery("html, body").stop().animate({
      scrollTop: jQuery($anchor.attr("href")).offset().top
    }, 800);
    event.preventDefault();
  });

  jQuery("a.skipContent").click(function (e) {
    if (e.type === 'keydown' && (e.key === 'Enter' || e.key === ' ')) {
      var $anchor = jQuery(this);
      jQuery("html, body")
        .stop()
        .animate({
          scrollTop: jQuery($anchor.attr("href")).offset().top
        }, 800);
      e.preventDefault();
    }
  });

  // Skip to main content focus jump

  jQuery(".skipContent").click(function (e) {
    e.preventDefault();
    e.stopPropagation();
    jQuery("#SkipContent").attr("tabindex", "0").focus();
  });
  jQuery("#SkipContent").attr("tabindex", "-1");

  jQuery(document).click(function () {
    jQuery("#SkipContent").attr("tabindex", "-1");
    jQuery("#SkipContent").blur();
  });



  //Keyboard accessing functions

  jQuery(document).ready(function (e) {
    jQuery("a[href='#top']").click(function () {
      jQuery("html, body").animate({
        scrollTop: 0
      },
        1000
      );
      return false;
    });

    function printData() {
      var divToPrint = document.getElementById("row-content");
      newWin = window.open("");
      newWin.document.write(divToPrint.outerHTML);
      newWin.print();
      newWin.close();
    }
    jQuery("#print").on("click", function () {
      jQuery("table").attr("border", "1");
      printData();
    });

    jQuery("#flexSlider").flexslider({
      animation: "slide",
      controlNav: true
    });

    jQuery("#flexSlider2").flexslider({
      animation: "slide",
      controlNav: true
    });

    jQuery("#flexSlider3").flexslider({
      animation: "slide",
      controlNav: true,
      directionNav: true
    });

    jQuery("#footerScrollbar").flexslider({
      animation: "slide",
      animationLoop: false,
      controlNav: false,
      itemWidth: 200,
      itemMargin: 10
    });

    jQuery("#footerScrollbar2").flexslider({
      animation: "slide",
      animationLoop: false,
      controlNav: false,
      itemMargin: 10,
      maxItems: 6
    });

    jQuery(".galleryCarasole").flexslider({
      animation: "slide",
      animationLoop: false,
      controlNav: false,
      itemWidth: 200,
      itemMargin: 20
    });

    jQuery(".galleryCarousel8").flexslider({
      animation: "slide",
      controlNav: false,
      animationLoop: false,
      slideshow: false,
      direction: "vertical"
    });

    jQuery(".galleryCarousel9").flexslider({
      animation: "slide",
      controlNav: false,
      animationLoop: false,
      slideshow: false,
      itemWidth: 150,
      itemMargin: 5,
      asNavFor: "#slider"
    });

    /* Photo gallery type 2 */
    jQuery("#carousel").flexslider({
      animation: "slide",
      controlNav: false,
      directionNav: false,
      animationLoop: true,
      minItems: 3,
      slideshow: false,
      itemWidth: 210,
      itemMargin: 5,
      direction: "vertical",
      asNavFor: "#slider"
    });

    jQuery("#slider").flexslider({
      animation: "slide",
      controlNav: false,
      animationLoop: false,
      slideshow: false,
      sync: "#carousel"
    });



    // Fancybox Accessibility js start
    let lastNavAction = null;

    /* Enhanced arrow + activation handling */
    $(document).on('keydown', '.fancybox-next, .fancybox-prev', function (e) {

      const isNext = $(this).hasClass('fancybox-next');
      const isPrev = $(this).hasClass('fancybox-prev');

      const isEnter = e.key === 'Enter' || e.keyCode === 13;
      const isSpace = e.key === ' ' || e.key === 'Spacebar' || e.keyCode === 32;
      const isRight = e.key === 'ArrowRight' || e.keyCode === 39;
      const isLeft = e.key === 'ArrowLeft' || e.keyCode === 37;

      /* ENTER / SPACE activation */
      if (isEnter || isSpace) {
        e.preventDefault();
        e.stopImmediatePropagation();

        lastNavAction = isNext ? 'next' : 'prev';
        isNext ? $.fancybox.next() : $.fancybox.prev();
        return;
      }

      /* RIGHT ARROW = NEXT */
      if (isRight) {
        e.preventDefault();
        e.stopImmediatePropagation();

        lastNavAction = 'next';
        $.fancybox.next();
        return;
      }

      /* LEFT ARROW = PREVIOUS */
      if (isLeft) {
        e.preventDefault();
        e.stopImmediatePropagation();

        lastNavAction = 'prev';
        $.fancybox.prev();
        return;
      }
    });

    /* Controlled Arrow navigation (only when modal is open) */
    $(document).on('keydown', function (e) {
      if (!$('.fancybox-wrap:visible').length) return;

      if (e.key === 'ArrowRight' || e.keyCode === 39) {
        e.preventDefault();
        lastNavAction = 'next';
        $.fancybox.next();
      }

      if (e.key === 'ArrowLeft' || e.keyCode === 37) {
        e.preventDefault();
        lastNavAction = 'prev';
        $.fancybox.prev();
      }
    });

    $(".fancybox").fancybox({

      beforeShow: function () {
        if (this.title) this.title += "<br/>";

        if ($(this.element).parents(".fancyShare").length > 0) {
          this.title += $(this.element)
            .parents(".fancyShare")
            .find(".hide.fancySocial")
            .html();
        }
      },

      helpers: {
        title: { type: "inside" }
      },

      afterShow: function () {

        var $currentLink = $(this.element);
        var simpleTitleText = $currentLink.data('simple-title');
        var titleID = 'modal-title-' + this.index;

        var $titleElement = $('.fancybox-title');
        if ($titleElement.length && simpleTitleText) {
          $titleElement
            .html('<span class="child">' + simpleTitleText + '</span>')
            .attr('id', titleID);
        }

        $('.fancybox-wrap').attr('aria-labelledby', titleID);

        var $modal = $('.fancybox-wrap:visible');

        setTimeout(() => {

          var $focusable = $modal.find(`
        a[href], area[href],
        input:not([disabled]):not([type="hidden"]),
        select:not([disabled]),
        textarea:not([disabled]),
        button:not([disabled]),
        [tabindex]:not([tabindex="-1"])
      `).filter(':visible');

          if (lastNavAction === 'next') {
            $('.fancybox-next:visible').focus();
          } else if (lastNavAction === 'prev') {
            $('.fancybox-prev:visible').focus();
          } else if ($focusable.length) {
            $focusable.first().focus();
          } else {
            $modal.attr('tabindex', '-1').focus();
          }

          lastNavAction = null;

          /* Focus trap */
          $(document)
            .off('keydown.fancybox-trap')
            .on('keydown.fancybox-trap', function (e) {

              if (e.key === 'Tab' || e.keyCode === 9) {

                var $focusable = $modal.find(`
              a[href], area[href],
              input:not([disabled]):not([type="hidden"]),
              select:not([disabled]),
              textarea:not([disabled]),
              button:not([disabled]),
              [tabindex]:not([tabindex="-1"])
            `).filter(':visible');

                if (!$focusable.length) return;

                var first = $focusable[0];
                var last = $focusable[$focusable.length - 1];

                if (e.shiftKey && document.activeElement === first) {
                  e.preventDefault();
                  last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                  e.preventDefault();
                  first.focus();
                }
              }

              if (e.key === 'Escape' || e.keyCode === 27) {
                $('.fancybox-close:visible').trigger('click');
              }
            });

        }, 0);
      },

      afterClose: function () {
        $('.fancybox-wrap, .fancybox-title').removeAttr('aria-labelledby id');
        $(this.element).focus();
        $(document).off('keydown.fancybox-trap');
        lastNavAction = null;
      }
    });
    // Fancybox Accessibility js ends




    jQuery("img.svg").each(function () {
      var e = jQuery(this),
        t = e.attr("id"),
        i = e.attr("class"),
        o = e.attr("src");
      jQuery.get(
        o,
        function (o) {
          var n = jQuery(o).find("svg");
          "undefined" != typeof t && (n = n.attr("id", t)),
            "undefined" != typeof i &&
            (n = n.attr("class", i + " replaced-svg")),
            (n = n.removeAttr("xmlns:a")),
            e.replaceWith(n);
        },
        "xml"
      );
    }),
      //addFocusClass(),
      jQuery(".various").fancybox({
        maxWidth: 800,
        maxHeight: 600,
        fitToView: !1,
        width: "70%",
        height: "70%",
        autoSize: !1,
        closeClick: !1,
        openEffect: "none",
        closeEffect: "none",
        afterShow: function () {
          var $fancyboxSkin = jQuery(".fancybox-skin").attr("tabindex", "-1").focus();

          // Focus trap setup
          var $focusableEls = $fancyboxSkin
            .find('a[href], button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select, [tabindex]:not([tabindex="-1"])')
            .filter(':visible');

          var firstFocusableEl = $focusableEls.first()[0];
          var lastFocusableEl = $focusableEls.last()[0];

          function trapFocus(e) {
            var isTabPressed = (e.key === 'Tab' || e.keyCode === 9);
            var isEscPressed = (e.key === 'Escape' || e.keyCode === 27);

            if (isEscPressed) {
              jQuery.fancybox.close();
              return;
            }

            if (!isTabPressed) return;

            if (e.shiftKey) { // Shift + Tab
              if (document.activeElement === firstFocusableEl) {
                e.preventDefault();
                lastFocusableEl.focus();
              }
            } else { // Tab
              if (document.activeElement === lastFocusableEl) {
                e.preventDefault();
                firstFocusableEl.focus();
              }
            }
          }

          jQuery(document).on('keydown.fancybox-trap', trapFocus);
        },

        afterClose: function () {
          jQuery(document).off('keydown.fancybox-trap');
          var $trigger = jQuery('.fancybox, .various');
          if ($trigger && $trigger.length) {
            $trigger.focus();
          }
        }
      });

    jQuery("#infotab").easyResponsiveTabs({
      type: "default",
      width: "auto",
      fit: true,
      tabidentify: "hor_1",
      activate: function (event) {
        var $tab = jQuery(this);
        var $info = jQuery("#nested-tabInfo");
        var $name = jQuery("span", $info);
        $name.text($tab.text());
        $info.show();
      }
    });

    jQuery("#galleryTab").easyResponsiveTabs({
      type: "default",
      width: "auto",
      fit: true,
      tabidentify: "hor_1",
      activate: function (event) {
        // Callback function if tab is switched
        var $tab = jQuery(this);
        var $info = jQuery("#nested-tabInfo");
        var $name = jQuery("span", $info);
        $name.text($tab.text());
        $info.show();
      }
    });

    jQuery(".tabassign").easyResponsiveTabs({
      type: "default",
      width: "auto",
      fit: true,
      tabidentify: "hor_1",
      activate: function (event) {
        // Callback function if tab is switched
        var $tab = jQuery(this);
        var $info = jQuery("#nested-tabInfo");
        var $name = jQuery("span", $info);
        $name.text($tab.text());
        $info.show();
      }
    });

    jQuery(".tabassignVertical").easyResponsiveTabs({
      type: "vertical",
      width: "auto",
      fit: true,
      tabidentify: "hor_1",
      activate: function (event) {
        // Callback function if tab is switched
        var $tab = jQuery(this);
        var $info = jQuery("#nested-tabInfo");
        var $name = jQuery("span", $info);
        $name.text($tab.text());
        $info.show();
      }
    });

    jQuery("table")
      .not(".no-responsive")
      .basictable({
        breakpoint: 991,
        forceResponsive: true
      });

    jQuery("img.svg").each(function () {
      var $img = jQuery(this);
      var imgID = $img.attr("id");
      var imgClass = $img.attr("class");
      var imgURL = $img.attr("src");

      jQuery.get(
        imgURL,
        function (data) {
          var $svg = jQuery(data).find("svg");

          if (typeof imgID !== "undefined") {
            $svg = $svg.attr("id", imgID);
          }
          if (typeof imgClass !== "undefined") {
            $svg = $svg.attr("class", imgClass + " replaced-svg");
          }

          $svg = $svg.removeAttr("xmlns:a");

          // Replace image with new SVG
          $img.replaceWith($svg);
        },
        "xml"
      );
    });

    //addFocusClass();

    //$('.appendedemblemList').remove();

    jQuery(".viewSwicther .thumbs-view-btn").click(function (e) {
      e.preventDefault();
      jQuery(".thumbs_view").removeClass("list-view");
    });

    jQuery(".viewSwicther .thumbs-list-view-btn").click(function (e) {
      e.preventDefault();
      jQuery(".thumbs_view").addClass("list-view");
      //$(".viewSwicther a").removeClass('viewSwictherActive');

      //$(this).addClass('viewSwictherActive');
    });

    jQuery(".HomeGalleryCarasole.single-page-gallery").flexslider({
      animation: "slide",
      controlNav: false,
      animationLoop: true,
      slideshow: false,
      itemWidth: 252,
      minItems: getGridSize(),
      maxItems: getGridSize()
    });

    function getGridSize() {
      return window.innerWidth <= 320 ?
        1 :
        window.innerWidth < 600 ?
          2 :
          window.innerWidth < 800 ?
            3 :
            window.innerWidth < 900 ?
              3 :
              4;
    }
  });

  //Accessibility Mobile
  jQuery(window).resize(function () {
    jQuery(".accessiblelinks").removeAttr("style");
    if (jQuery(window).innerWidth() <= 940) {
      jQuery(".accessible-icon").click(function () {
        jQuery(".accessiblelinks").show();
      });

      jQuery(document).on("click", function (e) {
        if (jQuery(window).innerWidth() <= 940) {
          if (jQuery(e.target).closest(".accessible-icon").length === 0) {
            jQuery(".accessiblelinks").hide();
          }
        }
      });

      jQuery(".accessible-icon").on("keyup", function (e) {
        if (e.keyCode == 9) {
          if (e.shiftKey) { } else {
            jQuery(".accessiblelinks").show();
          }
        }
      });

      jQuery(".accessiblelinks ul a:last").on("keydown", function (e) {
        if (e.keyCode == 9) {
          if (e.shiftKey) { } else {
            jQuery(".accessiblelinks").hide();
          }
        }
      });
    }
  });

  jQuery(document).ready(function () {
    jQuery(".accessiblelinks").removeAttr("style");
    if (jQuery(window).innerWidth() <= 940) {
      jQuery(".accessible-icon").click(function () {
        jQuery(".accessiblelinks").show();
      });

      jQuery(document).on("click", function (e) {
        if (jQuery(window).innerWidth() <= 940) {
          if (jQuery(e.target).closest(".accessible-icon").length === 0) {
            jQuery(".accessiblelinks").hide();
          }
        }
      });

      jQuery(".accessible-icon").on("keyup", function (e) {
        if (e.keyCode == 9) {
          if (e.shiftKey) { } else {
            jQuery(".accessiblelinks").show();
          }
        }
      });

      jQuery(".accessiblelinks ul a:last").on("keydown", function (e) {
        if (e.keyCode == 9) {
          if (e.shiftKey) { } else {
            jQuery(".accessiblelinks").hide();
          }
        }
      });
    }
  });
})(jQuery);

jQuery(document).ready(function ($) {
  jQuery("table").each(function () {
    var numCols = jQuery(this).find("tr")[0].cells.length;
    if (numCols < 4) {
      jQuery(this).css("table-layout", "fixed");
    }
  });
  //less than 4 column table layout fixed end


  $(".goiSearch form, .search-area form, .header-middle form").on("submit", function (e) {
    let search = $(this).find("#search");
    if (search.val() == "" || search.val().length < 3) {
      alert("Search text should be minimum 3 characters long!");
      search.focus();
      e.preventDefault();
    }
  });

  $("#heading1 .accordian-head").attr("aria-expanded", "true");

  jQuery(".menuToggle").click(function (e) {
    $(this).toggleClass("clicked");
  });
});

jQuery(document).ready(function ($) {
  setTimeout(function () {
      $('.captcha-refresh-btn').trigger('click');
  }, 500);
});

jQuery(document).ready(function ($) {
  let audioTag = document.getElementById("audioTag");
  let isPlaying = false;
  $("#play-btn").on("click", function () {
    if (isPlaying) {
      audioTag.pause();
      isPlaying = false;
      $(this).html("Play");
    } else {
      audioTag.play();
      isPlaying = true;
      $(this).html("Pause");
    }
  });
  $("#s3waas-read-text").on("click", function () {
    $("#show-description").slideToggle();
  });
});
// website scroll progress bar on top of webpage
document.addEventListener("DOMContentLoaded", function () {
  window.onscroll = function () {
    updateProgressBar();
  };

  function updateProgressBar() {
    let progressBar = document.getElementById("WebProgressBar");
    if (!progressBar) return;

    let scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
    let scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    let scrolled = (scrollTop / scrollHeight) * 100;
    progressBar.style.width = scrolled + "%";
  }
});

// Scroll back to top start
jQuery(document).ready(function ($) {
  var gototop = $("#gototop-btn");

  $(window).scroll(function () {
    if ($(window).scrollTop() > 200) {
      gototop.addClass("show");
    } else {
      gototop.removeClass("show");
    }
  });

  gototop.on("click", function (e) {
    e.preventDefault();
    $("html, body").animate({
      scrollTop: 0
    }, "300");
  });
});

// Scroll back to top end


jQuery(document).ready(function ($) {
  $('.pagination ul li.current a').addClass('accent-color');
});


jQuery(function ($) {

    $('.sortable-table').each(function () {

        if (!$.fn.DataTable.isDataTable(this)) {

            $(this).DataTable({
                responsive: true,
                paging: true,
                searching: true,
                ordering: true,
                info: true,
                pageLength: 10,
                autoWidth: false
            });

        }

    });

});