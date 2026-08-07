// Code for Acessible Main menu

jQuery(document).ready(function($) {
//adding outline on menu if meniitems focused
    $('.menuWrapper nav')
    .on('focusin', function () {
        $(this).addClass('menu-focused');
    })
    .on('focusout', function () {
        let $this = $(this);
        setTimeout(function () {
        if (!$this.find(':focus').length) {
            $this.removeClass('menu-focused');
        }
        }, 10);
    });


     $('.menuWrapper nav ul ul.sub-menu').each(function () {
        const $submenu = $(this);
        const $parentLi = $submenu.closest('li'); // parent <li> with sub-menu
        const $parentLink = $parentLi.children('a').first();

        if ($parentLink.length) {
            const linkText = $.trim($parentLink.clone().children().remove().end().text());
            if (linkText !== '') {
                $submenu.attr('aria-label', linkText + ' submenu');
            }
        }
    });

 function updateAriaExpanded($li, expanded) {
        const $link = $li.children("a");
        if ($li.children("ul.sub-menu").length) {
            $link.attr("aria-expanded", expanded ? "true" : "false");
        } else {
            $link.removeAttr("aria-expanded");
        }
    }

    function openMenu() {
        if ($("body").hasClass("rtl")) {
            $("#overflowMenu").animate({ left: "0px" });
        } else {
            $("#overflowMenu").animate({ right: "0px" });
        }
        $('#overflowMenu ul').find(' > li > a').attr('tabindex', 0);
        $('#overflowMenu a.closeMenu').attr('tabindex', 0);
    }

    
    function applyAriaRoles() {
        const $mainMenu = $(".menuWrapper nav > ul");

        $mainMenu.attr({ "role": "menubar"});

        const $topLevelLinks = $mainMenu.find("> li > a");

        $topLevelLinks.each(function(index) {
            const $link = $(this);
            $link.attr("role", "menuitem");
            $link.attr("tabindex", index === 0 ? "0" : "-1");

            const $parentLi = $link.closest("li");
            $parentLi.attr("role", "none");

            if ($parentLi.children("ul.sub-menu").length) {
                $link.attr("aria-haspopup", "true");
                updateAriaExpanded($parentLi, false);
            } else {
                $link.removeAttr("aria-haspopup aria-expanded");
            }
        });

        $(".menuWrapper nav ul ul.sub-menu").attr("role", "menu");
        $(".menuWrapper nav ul ul.sub-menu > li").attr("role", "none");
        $(".menuWrapper nav ul ul.sub-menu > li > a").attr("role", "menuitem").attr("tabindex", "-1"); // set all submenu items to -1 initially
    }

    applyAriaRoles();



    function closeSubMenu($li) {
        $li.find("> ul.sub-menu").slideUp().attr("aria-hidden", "true");
        updateAriaExpanded($li, false);
        $li.find("> ul.sub-menu > li > a").attr("tabIndex", -1);
        $li.find("> ul.sub-menu > li > ul.sub-menu").slideUp().attr("aria-hidden", "true");
        $li.find("> ul.sub-menu > li > a").each(function() {
            updateAriaExpanded($(this).parent(), false);
        });
    }

    function openSubMenu($li, focusLast = false, focusFirst = false) {
        $li.find("> ul.sub-menu").slideDown().attr("aria-hidden", "false");
        updateAriaExpanded($li, true);
        $li.find("> ul.sub-menu > li > a").attr("tabIndex", 0);
        if ($li.closest("ul.sub-menu").length > 0) {
            $li.find("> ul.sub-menu").css({ display: "block", right: "-250px" });
        }
        if (focusLast) {
            $li.find("> ul.sub-menu > li:last > a").focus();
        } else if (focusFirst) {
            $li.find("> ul.sub-menu > li:first > a").focus();
        }
    }

    function onMenuItemClick(event) {
        const $submenu = $(this).children("ul.sub-menu");
        const $link = $(this).children("a");
        if ($submenu.length) {
            $(this).siblings("li").find("ul.sub-menu").slideUp().attr("aria-hidden", "true")
                .siblings("a").each(function() {
                    updateAriaExpanded($(this).parent(), false);
                });

            const isVisible = $submenu.is(":visible");
            // $submenu.slideToggle();
            $submenu.attr("aria-hidden", isVisible ? "true" : "false");
            updateAriaExpanded($(this), !isVisible);
            $submenu.find("> li > a").attr("tabIndex", isVisible ? -1 : 0);
            if ($(this).hasClass("has-sub-child")) {
                $submenu.css('left', '100%');
            }
            event.stopPropagation();
        }
    }

    $(".menuWrapper nav ul li").each(function () {
        if ($(this).children("ul.sub-menu").length) {
            $(this).on("click", onMenuItemClick);
        }
    });


    //Keyboard Navigation Handler for Main Menu, Overflow Menu and Submenus

    $(document).on("keydown", function(event) {
        const $currentElement = $(document.activeElement);

        const $menuWrapper = $(".menuWrapper nav, .moreNav");
        if ($menuWrapper.has($currentElement).length === 0) {
            return;
        }

        const isMainMenuItem =
            $currentElement.closest(".menuWrapper nav > ul > li").length > 0 ||
            $currentElement.closest(".moreNav").length > 0;

        const isInSubmenu = $currentElement.closest("ul.sub-menu").length > 0;

        const $mainMenuItems = $(".menuWrapper nav > ul > li > a:visible, .moreNav > a:visible").filter(function() {
            return $(this).closest("li").parents("ul").length === 1;
        });

        const currentIndex = $mainMenuItems.get().indexOf($currentElement[0]);

        const $parentLi = $currentElement.closest("li");
        const $submenuItems = isInSubmenu ? $currentElement.closest("ul.sub-menu").find("> li > a") : [];
        const submenuIndex = isInSubmenu ? $submenuItems.index($currentElement) : -1;

        // ENTER / SPACE
        if (event.which === 13 || event.which === 32) {
            event.preventDefault();
            if ($parentLi.children("ul.sub-menu").length) {
                openSubMenu($parentLi, false, true);
                // $parentLi.children("a").attr("aria-expanded", "true");
            } else {
                window.location.href = $currentElement.attr("href");
                // $parentLi.children("a").attr("aria-expanded", "false");
            }
        }


        // LEFT / RIGHT / UP / DOWN / HOME / END / ALPHABETICAL KEYS
        else if ([37, 38, 39, 40, 36, 35].includes(event.which) || (event.key.length === 1 && /[a-zA-Z0-9]/.test(event.key))) {
            event.preventDefault();

        if (event.which === 37) { // LEFT
            if (!isInSubmenu && isMainMenuItem) {
                    const prevIndex = currentIndex > 0 ? currentIndex - 1 : $mainMenuItems.length - 1;
                    $mainMenuItems.eq(prevIndex).focus();
                } else if (isInSubmenu) {
                    const $parentMenuItem = $currentElement.closest("ul.sub-menu").parent("li");
                    closeSubMenu($parentMenuItem);
                    $parentMenuItem.find("> a").focus().attr("aria-expanded", "false");
                }
            } 


                else if (event.which === 39) { // RIGHT
                    let $currentLi = $currentElement.closest("li");

                    // Case 1: On a submenu item that has its own nested submenu
                    if (isInSubmenu) {
                        let $nestedSubmenu = $currentLi.children("ul.sub-menu");
                        if ($nestedSubmenu.length > 0) {
                            // Open nested submenu
                            $nestedSubmenu.attr("aria-hidden", "false").slideDown().css({ display: "block", right: "-250px" });
                            $currentLi.children("a").attr("aria-expanded", "true");
                           
                            // Focus first item in nested submenu
                            $nestedSubmenu.find('a[role="menuitem"]:visible').first().focus();
                        } else {
                            // If no nested submenu, jump to next top-level menu item
                            let $topParentLi = $currentLi;
                            while ($topParentLi.closest("ul.sub-menu").length) {
                                $topParentLi = $topParentLi.closest("ul.sub-menu").parent("li");
                            }

                            // Close all open submenus of this top-level item
                            $topParentLi.find("ul.sub-menu").slideUp().attr("aria-hidden", "true");
                            $topParentLi.find("a[aria-expanded='true']").attr("aria-expanded", "false");
                            
                            const parentIndex = $mainMenuItems.index($topParentLi.find("> a"));
                            const nextIndex = parentIndex < $mainMenuItems.length - 1 ? parentIndex + 1 : 0;
                            $mainMenuItems.eq(nextIndex).focus();
                        }
                    } 

                    // Case 2: On a main menu item (not in submenu)
                    else if (!isInSubmenu && isMainMenuItem) {
                        const nextIndex = currentIndex < $mainMenuItems.length - 1 ? currentIndex + 1 : 0;
                        $mainMenuItems.eq(nextIndex).focus();
                    }
                }




            else if (event.which === 38) { // UP
               
                if (isInSubmenu) {
                    const newIndex = submenuIndex > 0 ? submenuIndex - 1 : $submenuItems.length - 1;
                    $submenuItems.eq(newIndex).focus();
                    if ($parentLi.children("ul.sub-menu").length) {
                        $parentLi.children("a").attr("aria-expanded", "true");
                    }
                } else if ($parentLi.children("ul.sub-menu").length) {
                    openSubMenu($parentLi, true);
                }

            } 
   
            else if (event.which === 40) { // DOWN
               
                if (isInSubmenu) {
                    const newIndex = submenuIndex < $submenuItems.length - 1 ? submenuIndex + 1 : 0;
                    $submenuItems.eq(newIndex).focus();
                    if ($parentLi.children("ul.sub-menu").length) {
                        $parentLi.children("a").attr("aria-expanded", "true");
                    }
                } else if ($parentLi.children("ul.sub-menu").length) {
                    openSubMenu($parentLi, false, true);
                }

            } 


            else if (event.which === 36) { // HOME
                if (isInSubmenu) {
                    $submenuItems.eq(0).focus();
                } else {
                    $mainMenuItems.eq(0).focus();
                }
            } else if (event.which === 35) { // END
                if (isInSubmenu) {
                    $submenuItems.eq($submenuItems.length - 1).focus();
                } else {
                    $mainMenuItems.eq($mainMenuItems.length - 1).focus();
                }
            } 
            
            else if (event.key.length === 1 && /[a-zA-Z0-9]/.test(event.key)) { // First-char nav
                const searchChar = event.key.toLowerCase();
                const items = isInSubmenu ? $submenuItems : $mainMenuItems;
                let startIndex = isInSubmenu ? submenuIndex + 1 : currentIndex + 1;
                if (startIndex >= items.length) startIndex = 0;
                for (let i = 0; i < items.length; i++) {
                    const index = (startIndex + i) % items.length;
                    const itemText = items.eq(index).text().trim().toLowerCase();
                    if (itemText.startsWith(searchChar)) {
                        items.eq(index).focus();
                        break;
                    }
                }
            }
        }


    });


    $('html').on('click', function(event) {
    // If clicked outside both main menu and overflow menu
    if (!$(event.target).closest('.menuWrapper, #overflowMenu').length) {
        $(".menuWrapper nav ul li ul.sub-menu").each(function () {
            $(this)
                .slideUp()
                .attr("aria-hidden", "true")
                .find("> li > a")
                .attr("tabindex", -1);
        });
        $(".menuWrapper nav ul li:has(ul.sub-menu) > a").attr("aria-expanded", "false");
        $("#overflowMenu .ofMenu ul li ul.sub-menu").each(function () {
                $(this)
                    .slideUp()
                    .attr("aria-hidden", "true")
                    .find("> li > a")
                    .attr("tabindex", -1);
            });
        $("#overflowMenu .ofMenu ul li:has(ul.sub-menu) > a").attr("aria-expanded", "false");
        }
    });


    $('.menu').on('click', function(event) {
        event.stopPropagation();
    });


    $(".menuWrapper nav ul li").each(function () {
    if ($(this).children("ul.sub-menu").length) {
        $(this).on("click", onMenuItemClick);
    }
});

    $("nav li li").mouseover(function() {
        if ($(this).children("ul.sub-menu").length == 1) {
            let parent = $(this);
            let child_menu = $(this).children("ul.sub-menu");
            if (
                $(parent).offset().left + $(parent).width() + $(child_menu).width() >
                $(window).width()
            ) {
                $(child_menu).css("left", "-" + $(parent).width() + "px");
            } else {
                $(child_menu).css("right", "-" + $(parent).width() + "px");
            }
        }
    });

    /***** Overflow Navigation Setup *****/

    if ($(window).innerWidth() >= 640) {
        let menuContanerWidth = $(".menuWrapper .container").width(),
            itemsTotalWith = 0;
        $(".menu > ul > li").each(function(s, a) {
            let itemClone = $(this).clone();
            itemClone.find('a').attr("tabindex", -1);
            if (
                ((itemsTotalWith += $(this).width()),
                    itemsTotalWith > menuContanerWidth - 100 &&
                    ($(this).hasClass("moreNav") ||
                        ($(this).remove(),
                            $("#overflowMenu .ofMenu > ul").append(itemClone)),
                        !($(".menu ul .moreNav").length > 0)))
            ) {
                let n = $(
                    '<li class="moreNav" role="none">' +
                    '<a href="javascript:void(0)" role="menuitem" aria-label="More Menu" title="More Menu"><span class="icon-menu" aria-hidden="true"></span><span class="hide">' +
                    $(".menuMoreText").html() +
                    "</span></a></li>"
                );
                $(".menuMoreText").html("");
                $(".menu>ul").append(n);
                n.click(openMenu);
            }
        });
    }

    // // More Button
    $(".moreNav a").on("click", function(event) {
        event.preventDefault(), event.stopPropagation();
        openMenu();
    });


    $('#overflowMenu').click(function(event) {
        event.stopPropagation();
    });


    $(".ofMenu ul li").on("click", onMenuItemClick);

    $('.ofMenu ul li').hover(function(e) {
        $(this).siblings().children('ul.sub-menu').slideUp();
        $(this).children('ul.sub-menu').slideDown();
    }, function() {
        $(this).parent().siblings().children('ul.sub-menu').slideUp();
    });

    /***** Responsive Navigation Setup *****/

    $(".menuToggle").click(function(event) {
        event.preventDefault();
        $(".menuWrapper").stop().slideToggle();
    });

    if ($(window).width() <= 639) {
        $(".menu ul li").each(function(index, element) {
            $(this).off('click');
            if ($(this).children("ul").length) {
                $(".indicator").hide();
                $("<a href='javascript:void(0)' aria-label='Click to expand submenu' class='menu-toggle' role='button'>&nbsp;</a>")
                    .insertAfter($(element).find(" > a "));
            }
        });
      
    }


    $(function() {
        $(".menu-toggle").each(function() {
            var menuTitle = $(this).closest("li").find("> a").text().trim();
            var expandText = S3WaaSAccessibilityParams.clickToExpand;
            var submenuWord = S3WaaSAccessibilityParams.submenu;

            $(this)
            .attr("aria-label", expandText + " " + menuTitle + " " + submenuWord)
            .attr("aria-expanded", "false");
        });
    });

    // On click on menutoggle update aria-labels
    $(".menu-toggle").click(function(event) {
        event.preventDefault();
        $(this).toggleClass("open").parents('li').siblings().children("ul.sub-menu").stop().slideUp('fast');
        $(this).next("ul.sub-menu").slideToggle('fast');

        $(this).parents('li').siblings().children("a").removeClass("open");
        $(this).parents('li').siblings().children("a.menu-select").removeClass("menu-select");
        $(this).prev().toggleClass("menu-select");

        var menuTitle = $(this).closest("li").find("> a").text().trim();
        var collapseText = S3WaaSAccessibilityParams.clickToCollapse;
        var expandText   = S3WaaSAccessibilityParams.clickToExpand;
        var submenuWord  = S3WaaSAccessibilityParams.submenu;

        if ($(this).hasClass("open")) {
            $(this).attr("aria-label", collapseText + " " + menuTitle + " " + submenuWord).attr("aria-expanded", "true");
        } else {
            $(this).attr("aria-label", expandText + " " + menuTitle + " " + submenuWord).attr("aria-expanded", "false");
        }
    });

    jQuery(".menuWrapper nav ul li ul.sub-menu > li > a, #overflowMenu .ofMenu ul li ul.submenu > li > a")
    .on("keydown", function(event) {
        const $submenu = $(this).closest("ul.sub-menu");
        const $submenuItems = $submenu.find("> li > a");
        const currentIndex = $submenuItems.index(this);

        // Trap focus within submenu
        if (event.which === 9) { // Tab key
            if (!event.shiftKey && currentIndex === $submenuItems.length - 1) {
                event.preventDefault();
                $submenuItems.eq(0).focus();
            } else if (event.shiftKey && currentIndex === 0) {
                event.preventDefault();
                $submenuItems.eq($submenuItems.length - 1).focus();
            }
        }

        if (event.which === 27) { // Escape key
            const $parentLi = $submenu.parent("li");
            closeSubMenu($parentLi);
            $parentLi.find("> a").focus().attr('aria-expanded', 'false');
            event.preventDefault();

        }

    });

    //if no submenu is open and esc key pressed move focus to first focusable element in main
    jQuery(".menuWrapper nav > ul > li > a").on("keydown", function(event) {
        if (event.which === 27) {
            const $levelFirstMenu = jQuery(this).closest("ul.sub-menu");

            if ($levelFirstMenu.length === 0) {
                const $firstMainLink = jQuery("main a:visible").first();
                if ($firstMainLink.length) {
                    $firstMainLink.focus();
                }
                event.preventDefault();
            }
        }
    });
});
// js to close submenu on ESC key press if submenu is already opened using mouse
jQuery(function ($) {

    $(document).on('keydown', function (e) {
        if (e.key === 'Escape') {

            const $nav = $('.menuWrapper nav, #accessibilityMenu').addClass('esc-off');
            setTimeout(() => $nav.removeClass('esc-off'), 200);
        }
    });

});


//overflow menu extra js for accessibility

jQuery(document).ready(function($) {
    const $ov = $('#overflowMenu');
    const ovWidth = $ov.width();

    // Ensure menu is collapsed on load
    $('.moreNav > a').attr('aria-expanded', 'false');
    $ov.hide().css('right', -ovWidth);
    $ov.find('.sub-menu').hide().attr('aria-hidden', 'true');
    $ov.find('a').attr('tabindex', -1);

    const $toggleButton = $('.moreNav > a');
    $toggleButton.attr({
        'aria-haspopup': 'true',
        'aria-expanded': 'false',
        'aria-controls': 'overflowMenu' // connects to the popup menu
    });
     $ov.attr({
            'role': 'dialog',
            'aria-modal': 'true'
        });

    function applyAttributes() {
        $ov.find('.ofMenu > ul').attr('role', 'menu');
        $ov.find('li').attr('role', 'none');
        $ov.find('a').attr('role', 'menuitem');
        $ov.find('li:has(ul.sub-menu) > a')
            .attr('aria-haspopup', 'true')
            .attr('aria-expanded', 'false')
            .attr('tabindex', -1);
        $ov.find('ul.sub-menu')
            .attr('role', 'menu')
            .attr('aria-hidden', 'true')
            .hide();
    }
    applyAttributes();

    function trapWithin($container) {
        const $focusables = $container.find('a:visible, button:visible').filter('[tabindex!="-1"]');
        const first = $focusables.first();
        const last = $focusables.last();

        $focusables.off('keydown.trap').on('keydown.trap', function(e) {
            const $items = $focusables;
            const currentIndex = $items.index(this);

            if (e.key === 'Tab') {
                if (e.shiftKey && this === first[0]) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && this === last[0]) {
                    e.preventDefault();
                    first.focus();
                }
            }

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                const nextIndex = (currentIndex + 1) % $items.length;
                $items.eq(nextIndex).focus();
            }

            if (e.key === 'ArrowUp') {
                e.preventDefault();
                const prevIndex = (currentIndex - 1 + $items.length) % $items.length;
                $items.eq(prevIndex).focus();
            }
        });
    }

    function openOverflow() {
    if ($ov.is(':visible')) return;

    $toggleButton.attr('aria-expanded', 'true');

    $ov.css({
        right: -ovWidth,
        display: 'block'
    }).animate({
        right: 0
    }, 400, function () {
        $ov.find('a').attr('tabindex', 0);
        // const $firstItem = $ov.find('.ofMenu > ul > li > a:visible').first();
        // $firstItem.focus();
        $ov.focus().css('outline','2px solid black')
        trapWithin($ov);

        announceMenuStatus('More menu expanded');
    });
    }


    function closeOverflow() {
    $ov.animate({
        right: -ovWidth
    }, 400, function () {
        $ov.css('display', 'none');
        $ov.find('a').attr('tabindex', -1);
        $ov.find('[aria-expanded="true"]').each(function () {
        $(this)
            .attr('aria-expanded', 'false')
            .next('ul.sub-menu')
            .hide()
            .attr('aria-hidden', 'true');
        });
        $ov.find('*').off('keydown.trap');
        $toggleButton.attr('aria-expanded', 'false').focus();

        announceMenuStatus('More menu collapsed');
    });
    }

    function toggleSubmenu($link, open) {
        const $sub = $link.next('.sub-menu');
        $link.attr('aria-expanded', open);
        $sub.attr('aria-hidden', !open)[open ? 'slideDown' : 'slideUp']();
        if (open) {
            const $first = $sub.find('a:visible').first().focus();
            trapWithin($sub);
        } else {
            $sub.find('*').off('keydown.trap');
            $link.focus();
        }
    }

    $('.moreNav > a').on('click keydown', function(e) {
        if (e.type === 'click' || e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openOverflow();
        }
    });

    $ov.find('.closeMenu').on('click keydown', function(e) {
        if (e.type === 'click' || e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            closeOverflow();
        }
    });

    $ov.on('keydown', 'a', function(e) {
        const key = e.which;
        const $link = $(this);
        const $li = $link.parent('li');
        const isParent = $li.children('ul.sub-menu').length > 0;
        let $all = $ov.find('a:visible');
        let idx = $all.index(this);

        if ([13, 32].includes(key)) {
            e.preventDefault();
            if (isParent) {
                toggleSubmenu($link, $link.attr('aria-expanded') == 'false');
            } else {
                location.href = $link.attr('href');
            }
        } else if (key === 27) {
            const $visibleSubmenus = $ov.find('ul.sub-menu:visible').filter(function() {
                return $(this).css('display') !== 'none';
            });

            if ($visibleSubmenus.length > 0) {
                const $deepestSubmenu = $visibleSubmenus.sort((a, b) => {
                    return $(a).parents('ul.sub-menu').length - $(b).parents('ul.sub-menu').length;
                }).last();

                const $parentLi = $deepestSubmenu.parent('li');
                const $parentLink = $parentLi.children('a');

                $deepestSubmenu.slideUp().attr('aria-hidden', 'true');
                $parentLink.attr('aria-expanded', 'false');
                $deepestSubmenu.find('*').off('keydown.trap');
                $parentLink.focus();
            } else {
                closeOverflow();
            }
            e.preventDefault();
        } else if (key === 37) {
            e.preventDefault();
            const $submenu = $link.closest('ul.sub-menu');
            const $allMain = $ov.find('.ofMenu > ul > li > a:visible');

            if ($submenu.length > 0) {
                const $parentLi = $submenu.parent('li');
                const $parentLink = $parentLi.children('a');
                $submenu.slideUp().attr('aria-hidden', 'true');
                $parentLink.attr('aria-expanded', 'false');
                $parentLink.focus();
            } else {
                const prev = (idx - 1 + $all.length) % $all.length;
                $all.eq(prev).focus();
            }
        } else if (key === 39) {
            e.preventDefault();
            const $submenu = $link.closest('ul.sub-menu');
            const $allMain = $ov.find('.ofMenu > ul > li > a:visible');

            if ($submenu.length > 0) {
                const $parentLi = $submenu.parent('li');
                const $parentLink = $parentLi.children('a');
                $submenu.slideUp().attr('aria-hidden', 'true');
                $parentLink.attr('aria-expanded', 'false');
                const mainIdx = $allMain.index($parentLink);
                const nextIdx = (mainIdx + 1) % $allMain.length;
                $allMain.eq(nextIdx).focus();
            } else {
                const next = (idx + 1) % $all.length;
                $all.eq(next).focus();
            }
        } else if (key === 36) {
            e.preventDefault();
            $all.first().focus();
        } else if (key === 35) {
            e.preventDefault();
            $all.last().focus();
        }
    });

    $(document).on('click', function(e) {
        if ($ov.is(':visible') && !$(e.target).closest('#overflowMenu, .moreNav').length) {
            closeOverflow();
        }
    });

    $(window).on('unload', function () {
        $ov.hide().css('right', -ovWidth);
        $ov.find('.sub-menu').hide().attr('aria-hidden', 'true');
        $ov.find('a').attr('tabindex', -1);
        $ov.find('[aria-expanded="true"]').attr('aria-expanded', 'false');
    });

    // Append HTML in body for screen reader purpose only 
    if ($('#menu-status').length === 0) {
    $('body').append('<div id="menu-status" role="status" aria-live="polite" style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;"></div>');
    }

    // overflow menu expand/collapse message for screen reader
    function announceMenuStatus(message) {
    const $status = $('#menu-status');
    $status.text(''); // Clear first to force re-announcement
    setTimeout(() => $status.text(message), 10); 
    }


});

//Add aria-modal and role dialog attr on mobile menu wrapper 
jQuery(document).ready(function($) {
  function updateMenuWrapperAttrs() {
  if($(window).width()< 640){
  
  const mobileMenuOpen = $(".menuToggle").hasClass("clicked");
  
  $(".menuWrapper")
  .attr("aria-hidden", mobileMenuOpen ? "false": "true")
  }
  else{
  $(".menuWrapper")
  .removeAttr("aria-hidden")
  }
  
  }
  
   updateMenuWrapperAttrs();
  $(window).on("resize", updateMenuWrapperAttrs );
    $(".menuToggle").on("click", function(e) {
      setTimeout (updateMenuWrapperAttrs, 10)
    });
  
  });




// code to handle menulink having link & submenu both  for desktop and keyboard Navigation start

    jQuery(document).ready(function ($) {

        $(".menuWrapper nav li.menu-item-has-children > a").on("keydown.realLinkFix", function (e) {

            const $link = $(this);
            const href = $link.attr("href") || "";
            const isRealLink = href !== "#" && !href.startsWith("javascript");

            if (isRealLink && (e.key === "Enter" || e.key === " ")) {
                e.stopImmediatePropagation();
                return true;
            }

        });
            //Menu hints text announcement for screen reader code start
                if ($("#menu-hint-global").length === 0) {
                    $("body").append(
                        '<div id="menu-hint-global" aria-live="polite" role="status" ' +
                        'style="position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden;"></div>'
                    );
                }

                const MENU_HINT_TEXT = "Press Enter to open the link. Press Down Arrow to open the submenu.";

               $(".menuWrapper nav li.menu-item-has-children > a")
                    .on("focus.realHint", function () {

                        const $link = $(this);
                        const href = $link.attr("href") || "";
                        const isRealLink = href !== "#" && !href.startsWith("javascript");

                        if (!isRealLink) return;

                        $link.find(".menu-real-link-hint-wrapper").remove();

                        setTimeout(function () {

                            const inlineHintText = $(
                                '<span class="menu-real-link-hint-wrapper" aria-live="polite" ' + 'style="position:absolute;left:-9999px;top:-9999px;">' +
                                    '<span class="menu-real-link-hint">' + MENU_HINT_TEXT + '</span>' +
                                '</span>'
                            );
                            $link.append(inlineHintText);
                            const $globalMenuHint = $("#menu-hint-global");
                            $globalMenuHint.text("");
                            setTimeout(function () {
                                $globalMenuHint.text(MENU_HINT_TEXT);
                            }, 50);

                        }, 300); 

                    })
                    .on("blur.realHint", function () {
                        const $link = $(this);
                        $link.find(".menu-real-link-hint-wrapper").remove();

                        $("#menu-hint-global").text("");
                    });

          

        // Handelling menu links with link as well as submenu  in mobile device js start
           

            // let lastInputType = "mouse"; 
            // let lastTouchedLink = null;

            // $(document)
            //     .on("keydown.inputMode", function () {
            //     lastInputType = "keyboard";
            //     })
            //     .on("touchstart.inputMode pointerdown.inputMode", function () {
            //     lastInputType = "touch";
            //     })
            //     .on("mousedown.inputMode", function () {
            //     lastInputType = "mouse";
            //     });

            // /* TOUCH-ONLY MENU LOGIC */
            // $(".menuWrapper nav li.menu-item-has-children > a")
            //     .on("click.touchMenu", function (e) {

            //     //  If keyboard is being used → behave like desktop
            //     if (lastInputType === "keyboard") return;

            //     const $link = $(this);
            //     const href = $link.attr("href") || "";
            //     const isRealLink = href !== "#" && !href.startsWith("javascript");
            //     const $parentLi = $link.parent("li");

            //     if (!isRealLink) return;

            //     // First touch → open submenu
            //     if (!$parentLi.hasClass("submenu-open")) {
            //         e.preventDefault();

            //         $(".menuWrapper nav li.submenu-open")
            //         .removeClass("submenu-open");

            //         $parentLi.addClass("submenu-open");
            //         lastTouchedLink = this;
            //         return;
            //     }

            //     // Second touch on same link → allow navigation
            //     if (lastTouchedLink === this) {
            //         lastTouchedLink = null;
            //         return true;
            //     }

            //     });

            // /* TOUCHED OUTSIDE CLOSE SUBMENU */
            // $(document).on("touchstart", function (e) {
            //     if (!$(e.target).closest(".menuWrapper").length) {
            //     $(".menuWrapper nav li.submenu-open").removeClass("submenu-open");
            //     lastTouchedLink = null;
            //     }
            // });

             // Handelling menu links with link as well as submenu  in mobile device js ends
    });
    
// code to handle menulink having link & submenu both  for desktop and keyboard Navigation end


//handle esc key functionality js start 

jQuery(document).ready(function ($) {

    $(document).on('keydown.overflowEscHandler', function (e) {

        if (e.key === "Escape" || e.keyCode === 27) {

            const $ov = $('#overflowMenu');

            // run only if overflow menu is open
            if ($ov.is(':visible')) {

                // if focus is inside overflow menu → let existing logic handle it
                if ($(document.activeElement).closest('#overflowMenu').length) {
                    return;
                }

                // otherwise close overflow
                e.preventDefault();

                const ovWidth = $ov.width();

                $ov.animate({ right: -ovWidth }, 400, function () {
                    $ov.css('display', 'none');
                    $ov.find('a').attr('tabindex', -1);
                    $('.moreNav > a').attr('aria-expanded', 'false').focus();
                });

            }

        }

    });

});

//handle esc key functionality js ends

