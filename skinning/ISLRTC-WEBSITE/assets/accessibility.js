jQuery(document).ready(function ($) {


    let excludeExternalLinks = S3WaaSAccessibilityParams.excludeExternalLinks.split(',').filter(n => n);

    if (!String.prototype.startsWith) {
        String.prototype.startsWith = function (searchString, position) {
            position = position || 0;
            return this.substr(position, searchString.length) === searchString;
        };
    }

    $('body').on('targetExternalLinks', function () {

        var isExternal = function (url) {
            if (!url.match('^(https?:)?(\\/\\/).*$')) return false;
            return !(location.href.replace("http://", "").replace("https://", "").split("/")[0] === url.replace("http://", "").replace("https://", "").split("/")[0]);
        }
        var isExternalExcluded = function (url) {
            if (!url.match('^(https?:)?(\\/\\/).*$')) return false;
            let excludeThisLink = false;
            return excludeExternalLinks.some(function (item, index) {
                if (url.indexOf(item) > -1) {
                    excludeThisLink = true;
                    return true;
                }
            });
        }

        $('a').each(function () {
            var href = $(this).attr('href');
            if (typeof href == 'undefined') {
                $(this).attr('href', 'javascript:void(0)');
                href = '#';
            }

            if ($(this).attr('hreflang') !== undefined) {
                if ($(this).attr('hreflang') == 'od') {
                    $(this).attr({ hreflang: 'or', lang: 'or' });
                }
                if ($(this).attr('aria-label') !== typeof undefined) {
                    $(this).attr('aria-label', $(this).text()).attr('title', $(this).text());
                }
            } else if (isExternal(href)) {

                if (
                    href.indexOf('cdn.s3waas.gov.in') == -1
                    && href.indexOf('auth.s3waas.gov.in') == -1
                    && href.indexOf('cdnbbsr.s3waas.gov.in') == -1
                    && href.indexOf('parichay') == -1
                    && !$(this).hasClass('fancybox.iframe')
                    && !$(this).hasClass('fancybox')
                ) {
                    if (typeof $(this).attr('onclick') === "undefined" && !isExternalExcluded(href)) {
                        $(this).attr("onclick", "return confirm('" + S3WaaSAccessibilityParams.externalLinkAlertTextBeforeSitename + " " + S3WaaSAccessibilityParams.blogInfoName + " " + S3WaaSAccessibilityParams.externalLinkAlertTextAfterSitename + "');");
                    }
                }

                if (typeof $(this).attr('aria-label') === "undefined" || typeof $(this).attr('title') === "undefined") {
                    var text = '';
                    if ($(this).text().trim() !== '') {
                        text = $(this).text().trim() + ' - ';
                    } else {
                        text = $(this).attr('href') + ' - ';
                    }

                    if (
                        href.indexOf('cdn.s3waas.gov.in') == -1
                        && href.indexOf('auth.s3waas.gov.in') == -1
                        && href.indexOf('cdnbbsr.s3waas.gov.in') == -1
                        && href.indexOf('parichay') == -1
                        && !$(this).hasClass('fancybox.iframe')
                        && !$(this).hasClass('fancybox')
                    ) {
                        
                    }
                }

                if (href.indexOf('auth.s3waas.gov.in') == -1 && href.indexOf('parichay') == -1) {
                    $(this).prop({ target: '_blank', rel: 'noopener noreferrer' });
                }
            }
        });

    })
    $('body').trigger('targetExternalLinks');
    $('.flex-direction-nav a.flex-prev').attr({ 'title': S3WaaSAccessibilityParams.flexNavPrevTitle, 'aria-label': S3WaaSAccessibilityParams.flexNavPrevTitle });
    $('.flex-pauseplay a.flex-pause').attr({ 'title': S3WaaSAccessibilityParams.flexNavPlayPauseTitle, 'aria-label': S3WaaSAccessibilityParams.flexNavPlayPauseTitle });
    $('.flex-direction-nav a.flex-next').attr({ 'title': S3WaaSAccessibilityParams.flexNavNextTitle, 'aria-label': S3WaaSAccessibilityParams.flexNavNextTitle });

    $('a[download]').each(function () {
        var ariaLabelPrevious = $(this).prev().attr('aria-label');
        if (typeof ariaLabelPrevious !== typeof undefined && typeof $(this).attr('aria-label') == typeof undefined) {
            var ariaLabel = $(this).prev().attr('aria-label').split('-')[0];
            ariaLabel = S3WaaSAccessibilityParams.ariaLabelDownload + ' ' + ariaLabel;
            $(this).attr('aria-label', ariaLabel).removeAttr('aria-hidden');
        }
    });
});

jQuery(document).ready(function ($) {
    setTimeout(function () {
        $('.whosWhoPhoneNumber span, .whosWhoEmailId span, .startDate span, .endDate span').attr('lang', 'en');
        $('#your-name').attr('aria-describedby', 'your-name-error');
        $('#your-email').attr('aria-describedby', 'yourEmailError');
        $('#your-message').attr('aria-describedby', 'your-message-error');
        $('#siwp_captcha_value_0').attr({ 'aria-describedby': 'captchaErrorAlert', 'autocomplete': 'off' });
    }, 3000);

});

//Play pause button in mobile
(function ($) {
    var isPaused = true;
    var firstInteraction = true; 
    $(document).on('touchstart', '.flex-pauseplay a', function (e) {

        e.preventDefault();
        e.stopImmediatePropagation();

        var $btn = $(this);
        var $slider = $btn.closest('.flexslider');

         if (firstInteraction) {
            $slider.flexslider('pause');
            firstInteraction = false;
        }
		if (!isPaused) {
            $slider.flexslider('pause');

            $btn.removeClass('flex-pause').addClass('flex-play');
            isPaused = true;

        } else {
            $slider.flexslider('play');

            $btn.removeClass('flex-play').addClass('flex-pause');
            isPaused = false;
        }
    });
})(jQuery);