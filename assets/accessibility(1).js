// Grid/List view accessibility start
jQuery(document).ready(function ($) {
    const viewSwitchButtons = document.querySelectorAll(".viewSwicther a");

    viewSwitchButtons.forEach((button) => {
        button.setAttribute("role", "button");

        // Set initial aria-pressed
        if (button.classList.contains("thumbs-view-btn")) {
            button.setAttribute("aria-pressed", "true");
        } else {
            button.setAttribute("aria-pressed", "false");
        }

        // Add click event
        button.addEventListener("click", () => {
            viewSwitchButtons.forEach((btn) => {
                btn.setAttribute("aria-pressed", "false");
            });

            button.setAttribute("aria-pressed", "true");
        });
    });
});

// Grid/List view accessibility end
jQuery(document).ready(function () {
    jQuery(".bhashini-dropdown-btn").attr('aria-label', 'Translate Language');
})
// accessible tabs js start
jQuery(document).ready(function () {
    // jQuery(".vc_tta-tabs-list").attr('aria-label', 'Tabs Group');

    const tabInstances = [];

    jQuery('.vc_tta-tabs-container').each(function (index) {
        const $tabContainer = jQuery(this);
        const $tabsList = $tabContainer.find('.vc_tta-tabs-list');
        const $tabItems = $tabsList.find('li');

        $tabItems.each(function () {
            const $li = jQuery(this).attr('role', 'none'); // role moved to li
            const $anchor = $li.find('a');
            const spanText = $anchor.find('.vc_tta-title-text').text().trim().replace(/\s+/g, '-').toLowerCase();
            const panelId = $anchor.attr('aria-controls');
            const anchorId = spanText + '-tab';
             const arialabelText = $anchor.find('.vc_tta-title-text').text().trim();
            // Move all aria and tab roles to <a>
            $anchor.attr({
                id: anchorId,
                role: 'tab',
                'aria-controls': panelId,
                'aria-selected': 'false',
                tabindex: '-1',
                'aria-label': arialabelText
               
            });

            $anchor.on('click', function (e) {
                e.preventDefault();
            });

            $anchor.on('click keydown', function (e) {
                if (e.type === 'click') {
                    tabInstances[index].setSelectedTab(this);
                }
            });

            $anchor.on('keydown', function (e) {
                tabInstances[index].onKeydown.call(tabInstances[index], e);
            });
        });

        const tablistEl = $tabsList.get(0);
        const instance = new TabsManual(tablistEl);
        tabInstances.push(instance);
    });

    setTimeout(function () {
        jQuery('.vc_tta-panel').each(function () {
            const $panel = jQuery(this);
            if (!$panel.attr('role')) {
                const panelId = $panel.attr('id');
                const $tab = jQuery('[aria-controls="' + panelId + '"]');
                const tabId = $tab.attr('id');

                if (panelId && tabId) {
                    $panel.attr({
                        role: 'tabpanel',
                        'aria-labelledby': tabId
                    });
                }
            }
        });
    }, 500);
});



'use strict';

class TabsManual {
    constructor(groupNode) {
        this.tablistNode = groupNode;
        this.tabs = Array.from(this.tablistNode.querySelectorAll('[role=tab]'));
        this.tabpanels = [];

        this.firstTab = this.tabs[0];
        this.lastTab = this.tabs[this.tabs.length - 1];

        for (let i = 0; i < this.tabs.length; i++) {
            const tab = this.tabs[i];
            const tabpanel = document.getElementById(tab.getAttribute('aria-controls'));
            tab.setAttribute('tabindex', '-1');
            tab.setAttribute('aria-selected', 'false');
            this.tabpanels.push(tabpanel);
        }

        this.setSelectedTab(this.firstTab);
    }

    setSelectedTab(currentTab) {
        this.tabs.forEach((tab, i) => {
            const panel = this.tabpanels[i];
            const isCurrent = currentTab === tab;

            tab.setAttribute('aria-selected', isCurrent ? 'true' : 'false');
            tab.setAttribute('tabindex', isCurrent ? '0' : '-1');

            if (isCurrent) {
                panel.classList.remove('is-hidden');
                jQuery(panel).addClass('vc_active').find('.vc_tta-panel-body').css('display', 'block');
                jQuery(tab).closest('li').addClass('vc_active');
            } else {
                panel.classList.add('is-hidden');
                jQuery(panel).removeClass('vc_active').find('.vc_tta-panel-body').css('display', 'none');
                jQuery(tab).closest('li').removeClass('vc_active');
            }
        });
    }


    moveFocusToTab(tab) {
        tab.focus();
    }

    moveFocusToPreviousTab(currentTab) {
        const index = this.tabs.indexOf(currentTab);
        const target = index === 0 ? this.lastTab : this.tabs[index - 1];
        this.moveFocusToTab(target);
    }

    moveFocusToNextTab(currentTab) {
        const index = this.tabs.indexOf(currentTab);
        const target = index === this.tabs.length - 1 ? this.firstTab : this.tabs[index + 1];
        this.moveFocusToTab(target);
    }

    onKeydown(event) {
        const currentTab = event.currentTarget;
        let handled = false;

        switch (event.key) {
            case 'ArrowLeft':
                this.moveFocusToPreviousTab(currentTab);
                handled = true;
                break;
            case 'ArrowRight':
                this.moveFocusToNextTab(currentTab);
                handled = true;
                break;
            case 'Home':
                this.moveFocusToTab(this.firstTab);
                handled = true;
                break;
            case 'End':
                this.moveFocusToTab(this.lastTab);
                handled = true;
                break;
            case 'Enter':
            case ' ':
                this.setSelectedTab(currentTab);
                handled = true;
                break;
        }

        if (handled) {
            event.preventDefault();
            event.stopPropagation();
        }
    }

}


// accessible tabs js ends


// home slider aria label added
jQuery(document).ready(function () {
    const $slides = jQuery('.home-slider .slides > li').not('.clone');
    const totalSlides = $slides.length;
    $slides.each(function (index) {
        jQuery(this).attr('aria-label', `Slide ${index + 1} of ${totalSlides}`);
    });
});

//Footer slider aria-label added
jQuery(document).ready(function() {
  const $slides = jQuery('.footerScrollbar .slides > li').not('.clone');
  const totalSlides = $slides.length;
    $slides.each(function (index) {
        jQuery(this).attr('aria-label', `Slide ${index + 1} of ${totalSlides}`);
    });
});

//Photo gallery slider aria-label added
jQuery(document).ready(function() {
  const $slides = jQuery('.HomeGalleryCarasole .slides > li').not('.clone');
  const totalSlides = $slides.length;
    $slides.each(function (index) {
        jQuery(this).attr('aria-label', `Slide ${index + 1} of ${totalSlides}`);
    });
});

//Photo gallery slider aria-label added
jQuery(document).ready(function() {
  const $slides = jQuery('#video_galery .slides > li').not('.clone');
  const totalSlides = $slides.length;
    $slides.each(function (index) {
        jQuery(this).attr('aria-label', `Slide ${index + 1} of ${totalSlides}`);
    });
});

// Dynamically arial-live handelling on silders start

jQuery(document).ready(function ($) {

  var $liveRegions = $('.flexslider');
    function deactivateLiveRegions() {
     $liveRegions.attr('aria-live', 'off');
    }

  function activateLiveRegion($target) {
    deactivateLiveRegions();
    $target.attr('aria-live', 'polite');
    }

//   $('.flexslider').on('focusin', function () {
//     activateLiveRegion($(this));
//     });

});
// Dynamically arial-live handelling on silders ends

// Tab aria label added for read more button
jQuery(document).ready(function($) {
    function updateAriaLabel() {
        jQuery('.vc_tta-panel.vc_active').each(function() {
            var activeTabTitle = jQuery(this).find('.vc_tta-title-text').first().text().trim();
            var $btn = jQuery(this).find('.vc_tta-panel-body .btn');
            var btnText = $btn.text().trim();
            $btn.attr('aria-label', btnText + ' ' + activeTabTitle);
        });
    }
    updateAriaLabel();
    jQuery('.vc_tta-tabs-list a').on('click', function() {
        setTimeout(updateAriaLabel, 100);
    });
});

// Tab heading level change from h4 to h3
// jQuery(document).ready(function($) {
//     $('.vc_tta-panels-container .vc_tta-panel-heading h4').each(function() {
//         var $newHeading3 = $('<h2>').html($(this).html());

//         // Copy all attributes
//         $.each(this.attributes, function() {
//             $newHeading3.attr(this.name, this.value);
//         });

//         $(this).replaceWith($newHeading3);
//     });
// });

jQuery(function($) {
    $('.vc_tta-panels-container .vc_tta-panel-heading h4').each(function() {
        const $h2 = $('<h2>', {
            html: $(this).html(),
            class: $(this).attr('class')
        });

        $(this).replaceWith($h2);
    });
});


// photo/vide gallery aria-label
jQuery(document).ready(function() {
    var photoGalleryTitle = jQuery(".photo-glry-cntr .gallery-heading h2").text().trim();
    var photoGalleryTitleTwo = jQuery(".gallery-layout-two .photo-glry-title h2").text().trim();
    var viewAllPhotoButtonText = jQuery(".photo-glry-cntr .bttn-more span").text().trim();
    var viewAllPhotoButtonTextTwo = jQuery(".gallery-layout-two .photo-glry-viewall a.btn").text().trim();
    
    if (photoGalleryTitle) {
        jQuery(".photo-glry-cntr .bttn-more").removeAttr("title").attr("aria-label", viewAllPhotoButtonText + ", " + photoGalleryTitle);
    }
    if (photoGalleryTitleTwo) {
        jQuery(".gallery-layout-two .photo-glry-viewall a.btn").removeAttr("title").attr("aria-label", viewAllPhotoButtonTextTwo + ", " + photoGalleryTitleTwo);
    }

    var videoGalleryTitle = jQuery(".video_gallery h2").text().trim();
    var viewAllVideoButtonText = jQuery(".video_gallery .gallery-links a.btn").text().trim();
    
    if (videoGalleryTitle) {
        jQuery(".video_gallery .gallery-links a.btn").removeAttr("title").attr("aria-label", viewAllVideoButtonText + ", " + videoGalleryTitle);
    }
});


// Additional Attributes for header parts 
jQuery(document).ready(function ($) {
    // jQuery('nav.menu').attr('aria-label','secondary')
    jQuery('.menuToggle').attr({'aria-expanded': 'false', 'role': 'button'});
    jQuery('.menuToggle').on('click', function () {
        const isExpanded = jQuery(this).attr('aria-expanded') === 'true';
        jQuery(this).attr('aria-expanded', isExpanded ? 'false' : 'true');
    });
 });



//  accordian Accessibility aria-expanded attributes
jQuery(document).ready(function ($) {
    // Remove unwanted attributes from panels
    $('.vc_tta-panel').each(function () {
        $(this).removeAttr('role').removeAttr('hidden');
    });

    // Loop through each panel
    $('.vc_tta-panel').each(function () {
        var $panel = $(this);
        var $pannelTitleTExt = $panel.find('.vc_tta-title-text');
        var $pannelAnchor = $panel.find('.vc_tta-panel-heading a[data-vc-accordion]');
        var $panelBody = $panel.find('.vc_tta-panel-body');
        var rawText = $pannelTitleTExt.text().trim();
        // var slug = rawText.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-_]/g, '');
        var slug = rawText.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\p{L}\p{N}\p{M}_-]/gu, '');

        var anchorID = slug + '-heading';
        var bodyID = slug + '-content';
         $pannelAnchor.attr({
            'id': anchorID,
            'aria-controls': bodyID,
            'role': 'button',
            'aria-expanded': 'false'
        });

        $panelBody.attr({
            'id': bodyID,
            'role': 'region',
            'aria-labelledby': anchorID
        });
    });

    // Set aria-expanded="true" for active panel
    $('.vc_tta-panel.vc_active .vc_tta-panel-heading a[data-vc-accordion]').attr('aria-expanded', 'true');

    // Toggle aria-expanded on click
    $('.vc_tta-panel-heading a[data-vc-accordion]').on('click', function () {
        setTimeout(function () {
            $('.vc_tta-panel').each(function () {
                var $panel = $(this);
                var $link = $panel.find('.vc_tta-panel-heading a[data-vc-accordion]');
                if ($panel.hasClass('vc_active')) {
                    $link.attr('aria-expanded', 'true');
                } else {
                    $link.attr('aria-expanded', 'false');
                }
            });
        }, 100);
    });
});






// fancybox js 
jQuery(document).ready(function ($) {
  $('.fancybox, .various').attr({
    "aria-haspopup": "dialog", 
    "role": "button"
  });
   $('.fancybox-wrap').attr({
    "role": "dialog", 
    "aria-modal": "true"
  });

});


// Footer menu Accessibility
jQuery(document).ready(function ($) {
    // jQuery('.footerMenu > ul').attr({"role": "menubar","aria-label":"Footer menu"})
    // jQuery('.footerMenu > ul > li').attr('role', 'none')
    // jQuery('.footerMenu > ul > li > a').attr('role', 'menuitem').attr('tabindex', '0')

    //made changes according to LCI report
    jQuery('.footerMenu > ul > li > a').attr('tabindex', '0')

    
    const menufooter = document.querySelector('.footerMenu [role="menubar"]');
    if (menufooter) {
        const items = Array.from(menufooter.querySelectorAll('[role="menuitem"]'));
    }

    function getFocusableElements() {
        return Array.from(document.querySelectorAll(`
        a[href]:not([disabled]),
        button:not([disabled]),
        input:not([disabled]),
        select:not([disabled]),
        textarea:not([disabled]),
        [tabindex]:not([tabindex="-1"])`)).filter(el => el.offsetParent !== null || el instanceof SVGElement);
    }

    // Move focus to first focusable element after footerMenu
    function focusAfterFooterMenu() {
        const footerMenu = document.querySelector('.footerMenu');
        const focusable = getFocusableElements();
        let found = false;

        for (let i = 0; i < focusable.length; i++) {
        if (footerMenu.contains(focusable[i])) {
            found = true;
        } else if (found) {
            focusable[i].focus();
            break;
        }
        }
    }

    items.forEach((item, index) => {
        item.addEventListener('keydown', function (e) {
        let newIndex;

        switch (e.key) {
            case 'ArrowRight':
            newIndex = (index + 1) % items.length;
            items[newIndex].focus();
            e.preventDefault();
            break;

            case 'ArrowLeft':
            newIndex = (index - 1 + items.length) % items.length;
            items[newIndex].focus();
            e.preventDefault();
            break;

            case 'Home':
            items[0].focus();
            e.preventDefault();
            break;

            case 'End':
            items[items.length - 1].focus();
            e.preventDefault();
            break;

            case 'Escape':
            focusAfterFooterMenu();
            e.preventDefault();
            break;

            // case 'Tab':
            // const isFirst = index === 0;
            // const isLast = index === items.length - 1;

            // if (!e.shiftKey && isLast) {
            //     // Trap Tab on last item
            //     e.preventDefault();
            //     items[0].focus();
            // } else if (e.shiftKey && isFirst) {
            //     // Trap Shift+Tab on first item
            //     e.preventDefault();
            //     items[items.length - 1].focus();
            // }
            // break;
        }
        });
    });
    
});


//aria-current page attribute for current menu links

jQuery(document).ready(function ($) {

    $(".menu ul li.active a").attr("aria-current", "page");

});


//home slider and newsticker slider managing tabindex for clone and active slides
jQuery(document).ready(function ($) {

  function updateSlideTabindex() {

    $('.home-slider.flexslider .slides li a, .newsticker.flexslider .slides li a')
      .attr('tabindex', '-1')
      .attr('aria-hidden', 'true');

    $('.home-slider.flexslider .slides li.flex-active-slide a, .newsticker.flexslider .slides li.flex-active-slide a')
      .attr('tabindex', '0')
      .attr('aria-hidden', 'false');

    $('.home-slider.flexslider .slides li.clone, .newsticker.flexslider .slides li.clone')
      .attr('tabindex', '-1')
      .removeAttr('aria-roledescription');

    $('.home-slider.flexslider .slides li')
      .attr('tabindex', '-1')
      .attr('role', 'group')
      .attr('aria-hidden', 'true');

    $('.home-slider.flexslider .slides li.flex-active-slide')
    .attr('tabindex', '-1')
    .attr('aria-hidden', 'false');
  }

  // Initial run AFTER DOM + FlexSlider settle
  requestAnimationFrame(function () {
    requestAnimationFrame(updateSlideTabindex);
  });

  $('.home-slider.flexslider .slides, .newsticker.flexslider .slides').each(function () {

    const slider = this;

    const observer = new MutationObserver(function (mutations) {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {

          // Wait until FlexSlider finishes toggling classes
          requestAnimationFrame(function () {
            requestAnimationFrame(updateSlideTabindex);
          });

          break;
        }
      }
    });

    observer.observe(slider, {
      attributes: true,
      subtree: true,
      attributeFilter: ['class']
    });
  });

});




// Flexslider keyborad accessibility features JS starts
jQuery(document).ready(function ($) {

    // NVDA Focus Mode Support
    $('.home-slider.flexslider, .newsticker.flexslider')
        // .on('focusin', function () {
        //     $(this).flexslider('pause');
        // })
        // .on('focusout', function () {
        //     $(this).flexslider('play');
        // });

    function moveFocusToActiveSlide(slider) {
        const $activeSlide = slider.find('.flex-active-slide');
        const $link = $activeSlide.find('a').first();

        if ($link.length) {
            $link.focus();
        } else {
            $activeSlide.attr('tabindex', '-1').focus();
        }
    }

    $('.home-slider.flexslider, .newsticker.flexslider').on('keydown', function (e) {

        const key = e.which;
        const slider = $(this);
        const activeEl = document.activeElement;

        const isPrevBtn = $(activeEl).hasClass('flex-prev');
        const isNextBtn = $(activeEl).hasClass('flex-next');

        // ENTER/Space on Prev Button
        if ((key === 13 || key === 32) && isPrevBtn) {
            slider.flexslider('prev');
            e.preventDefault();
            return;
        }

        // ENTER/Space on Next Button
        if ((key === 13 || key === 32) && isNextBtn) {
            slider.flexslider('next');
            e.preventDefault();
            return;
        }

        // LEFT arrow
        if (key === 37) {
            slider.flexslider('prev');
            setTimeout(() => moveFocusToActiveSlide(slider), 220);
            e.preventDefault();
        }

        // RIGHT arrow
        if (key === 39) {
            slider.flexslider('next');
            setTimeout(() => moveFocusToActiveSlide(slider), 220);
            e.preventDefault();
        }

        // HOME - first slide
        if (key === 36) {
            slider.flexslider(0);
            setTimeout(() => moveFocusToActiveSlide(slider), 220);
            e.preventDefault();
        }

        // END - last slide
        if (key === 35) {
            const lastIndex = slider.find('.slides > li').length - 1;
            slider.flexslider(lastIndex);
            setTimeout(() => moveFocusToActiveSlide(slider), 220);
            e.preventDefault();
        }

        // ENTER or SPACE on the SLIDER ITSELF - open link manually
        if ((key === 13 || key === 32) && $(activeEl).hasClass('flexslider')) {

            const $activeSlide = slider.find('.flex-active-slide');
            const $link = $activeSlide.find('a').first();

            if ($link.length) {
                e.preventDefault();
                $link[0].click();
            }
        }

    });

});
// Flexslider keyborad accessibility features JS ends




// Add toggle button status pressed/not pressed on accessibility menu buttons starts

jQuery(document).ready(function($) {

// Aria-pressed attr to be added on toggle buttons
  //  Mapping each button id to its corresponding body class
  const buttonClassMap = {
    'highlightLinks': 'highlightLinks',
    'invert': 'invert',
    'saturation': 'saturation',
    'addletterspacing': 'addletterspacing',
    'addlineheight': 'addlineheight',
    'hideimage': 'hideimage',
    'big_cursor' : 'big_cursor'
  };

  // Update aria-pressed for body-class based buttons
  function updateAriaPressed() {
    $.each(buttonClassMap, function(buttonId, bodyClass) {
      const $btn = $('#' + buttonId);
      if ($('body').hasClass(bodyClass)) {
        $btn.attr('aria-pressed', 'true');
      } else {
        $btn.attr('aria-pressed', 'false');
      }
    });
  }

  // Update aria-pressed for bhashini-tts button
  function updateBhashiniAria() {
    const $bhashini = $('#bhashini-tts-play');
    if ($bhashini.length) {
      const state = $bhashini.attr('data-state');
      if (state === 'pause') {
        $bhashini.attr('aria-pressed', 'true');
      } else {
        $bhashini.attr('aria-pressed', 'false'); // includes 'play' and initial
      }
    }
  }

  // Toggle aria-pressed for Screen Reader button
  const $screenReaderBtn = $('a[data-label="Screen Reader"]');
  if ($screenReaderBtn.length) {
    // set initial state
    $screenReaderBtn.attr('aria-pressed', 'false');

    $screenReaderBtn.on('click keydown', function(e) {
      if (e.type === 'click' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const $btn = $(this);
        const current = $btn.attr('aria-pressed') === 'true';
        $btn.attr('aria-pressed', current ? 'false' : 'true');
      }
    });
  }

  // Initial checks
  updateAriaPressed();
  updateBhashiniAria();

 // Observe body class changes dynamically (for body-class buttons)
  const observerBody = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      if (mutation.attributeName === 'class') {
        updateAriaPressed();
      }
    });
  });
  observerBody.observe(document.body, { attributes: true });

// Observe data-state changes for bhashini button
  const $bhashini = $('#bhashini-tts-play');
  if ($bhashini.length) {
    const observerBhashini = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.attributeName === 'data-state') {
          updateBhashiniAria();
        }
      });
    });
    observerBhashini.observe($bhashini[0], { attributes: true, attributeFilter: ['data-state'] });
  }

});

// Add toggle button status pressed/not pressed on accessibility menu buttons ends




// Remove role and aria-labelledby attr from tab panel body 
jQuery(document).ready(function ($) {

    function removeTabpanelRole(){
        $('.vc_tta-panel-body').removeAttr('role').removeAttr('aria-labelledby');
    }

    removeTabpanelRole();

    $('.vc_tta-tab a').on('click', function(){
        setTimeout(function(){
            removeTabpanelRole();
        }, 100);
    });

});


//iphone play/pause button fixed
// $('.flex-play, .flex-pause').on('click touchstart', function(){
  
// });