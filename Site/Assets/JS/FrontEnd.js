/**
 * ============================================
 * FrontEnd.js - Main Frontend Initialization
 * ============================================
 * 
 * This file handles all frontend initialization and ensures
 * all animations, interactions, and features work correctly.
 * 
 * Dependencies (must load in this order):
 * 1. jQuery (jquery-3.5.1.min.dc5e7f18c8.js) - Optional (for legacy support)
 * 2. animation_standalone.js - Animation engine
 * 3. This file (FrontEnd.js) - Custom initialization wrapper
 * 
 * NOTE: 
 * - animation_standalone.js does NOT require jQuery
 */

(function () {
    'use strict';

    // ============================================
    // Configuration
    // ============================================
    var config = {
        debug: false, // Set to true for console logging
        animationDelay: 100, // Delay before initializing animations
        fontLoadTimeout: 3000 // Timeout for font loading (ms)
    };

    // ============================================
    // Utility Functions
    // ============================================

    /**
     * Log messages in debug mode
     */
    function log(message, data) {
        if (config.debug && window.console) {
            if (data) {
                console.log('[FrontEnd] ' + message, data);
            } else {
                console.log('[FrontEnd] ' + message);
            }
        }
    }

    /**
     * Check if jQuery is loaded
     */
    function checkjQuery() {
        if (typeof jQuery === 'undefined') {
            log('ERROR: jQuery is not loaded!');
            return false;
        }
        log('✓ jQuery loaded (v' + jQuery.fn.jquery + ')');
        return true;
    }

    /**
     * Check if AnimEngine is loaded
     */
    function checkAnimEngine() {
        if (typeof window.AnimEngine !== 'undefined') {
            log('✓ AnimEngine loaded');
            return true;
        }
        log('ERROR: AnimEngine is not loaded!');
        return false;
    }

    /**
     * Wait for element to exist in DOM
     */
    function waitForElement(selector, callback, timeout) {
        timeout = timeout || 5000;
        var startTime = Date.now();

        function check() {
            var element = document.querySelector(selector);
            if (element) {
                callback(element);
            } else if (Date.now() - startTime < timeout) {
                setTimeout(check, 100);
            } else {
                log('Timeout waiting for element: ' + selector);
            }
        }
        check();
    }

    // ============================================
    // Font Loading Initialization
    // ============================================

    /**
     * Check font loading status
     * Note: Fonts are already loaded by webfont.js in HTML head
     * This just monitors the status
     */
    function initFonts() {
        // Fonts are already loaded by webfont.js in HTML
        // Just add a class when fonts are ready
        if (typeof WebFont !== 'undefined') {
            log('WebFont already loaded by HTML');
            // Check if fonts are already loaded (Google Fonts)
            if (document.fonts && document.fonts.ready) {
                document.fonts.ready.then(function () {
                    document.documentElement.classList.add('fonts-loaded');
                    log('✓ Fonts already loaded');
                });
            } else {
                document.documentElement.classList.add('fonts-loaded');
                log('✓ Fonts loaded');
            }
        } else {
            log('WebFont loader not found');
        }
    }

    // ============================================
    // Animation Initialization
    // ============================================

    /**
     * Initialize AnimEngine interactions and animations
     */
    function initAnimations() {
        if (!checkAnimEngine()) {
            return;
        }

        log('Initializing animations...');

        // AnimEngine may auto-initialize or may not have autoInit method
        if (typeof window.AnimEngine.autoInit === 'function') {
            if (window.ANIM_AUTO_INIT) {
                log('✓ AnimEngine auto-init enabled');
            } else {
                // Manually initialize if auto-init is disabled
                window.AnimEngine.autoInit();
                log('✓ AnimEngine manually initialized');
            }
        } else {
            log('✓ AnimEngine initialized automatically (no autoInit method)');
        }

        log('✓ Animations initialized');
    }

    // ============================================
    // Mobile Menu Handler
    // ============================================

    /**
     * Initialize mobile menu toggle
     */
    function initMobileMenu() {
        if (typeof jQuery === 'undefined') return;

        var $menuIcon = jQuery('.mobile-menu-icon');
        var $openIcon = jQuery('.mobile-menu-icon.open-icon');
        var $closeIcon = jQuery('.mobile-menu-icon.close-icon');
        var $sideMenu = jQuery('.side-menu');
        var $pageContent = jQuery('.page-content-wrapper');

        if ($menuIcon.length === 0) return;

        log('Initializing mobile menu...');

        // Toggle menu on icon click
        $menuIcon.on('click', function () {
            $sideMenu.toggleClass('menu-open');
            $pageContent.toggleClass('menu-open');
            $openIcon.toggle();
            $closeIcon.toggle();
        });

        // Function to close menu
        function closeMobileMenu() {
            $sideMenu.removeClass('menu-open');
            $pageContent.removeClass('menu-open');
            $openIcon.show();
            $closeIcon.hide();
        }

        // Close menu when clicking outside (desktop behavior)
        jQuery(document).on('click', function (e) {
            var isMobile = window.innerWidth <= 991;
            var clickedOnMenu = jQuery(e.target).closest('.side-menu, .mobile-menu-icon').length;

            // On desktop, close when clicking outside menu
            if (!isMobile && $sideMenu.hasClass('menu-open') && !clickedOnMenu) {
                closeMobileMenu();
            }
        });

        // Enhanced mobile behavior: Close menu when clicking/tapping on page content area
        // This is especially useful for portfolio project pages with lots of content
        function setupMobileContentClick() {
            $pageContent.off('click.mobileMenuClose touchstart.mobileMenuClose');

            if (window.innerWidth <= 991) {
                // Handle both click and touch events for better mobile support
                var closeHandler = function (e) {
                    if (!$sideMenu.hasClass('menu-open')) return;

                    var $target = jQuery(e.target);

                    // Don't close if clicking on menu or menu icon
                    if ($target.closest('.mobile-menu-icon, .side-menu').length) {
                        return;
                    }

                    // Don't close if clicking on interactive elements (links, buttons, inputs)
                    // Allow closing when clicking on text/content areas - this makes it easy to close menu on long pages
                    var isInteractive = $target.is('a, button, input, textarea, select, [onclick]') ||
                        $target.closest('a, button, input, textarea, select, [onclick], .primary-button, .secondary-button, .form-button, .form-input, iframe, video').length;

                    // Check if target has href attribute (is a link)
                    var hasHref = $target.is('[href]') || $target.closest('[href]').length;

                    // Close menu when clicking/tapping on page content (except links and buttons)
                    // This allows users to easily close menu by tapping anywhere on long portfolio pages
                    if (!isInteractive && !hasHref) {
                        closeMobileMenu();
                    }
                };

                $pageContent.on('click.mobileMenuClose', closeHandler);
                $pageContent.on('touchstart.mobileMenuClose', closeHandler);
            }
        }

        // Initialize mobile content click handler
        setupMobileContentClick();

        // Re-setup on window resize
        jQuery(window).on('resize', function () {
            setupMobileContentClick();
        });

        // Close menu on window resize (if desktop)
        jQuery(window).on('resize', function () {
            if (window.innerWidth > 991) {
                $sideMenu.removeClass('menu-open');
                $pageContent.removeClass('menu-open');
                $openIcon.show();
                $closeIcon.hide();
            }
        });

        log('✓ Mobile menu initialized');
    }

    // ============================================
    // Skill Block Click Handler (Mobile)
    // ============================================

    /**
     * Handle skill block clicks to prevent scroll-to-top
     */
    function initSkillBlocks() {
        if (typeof jQuery === 'undefined') return;

        // Prevent scroll-to-top on skill block links and add mobile touch support
        jQuery(document).on('click touchstart', '.tech-stack-block', function (e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            // Save current scroll position
            var scrollY = window.scrollY || window.pageYOffset;

            // Remove active class from all other skill blocks
            jQuery('.tech-stack-block').not(this).removeClass('active');

            // Toggle active class on clicked skill block for mobile
            if (window.innerWidth <= 991) {
                var $this = jQuery(this);
                if ($this.hasClass('active')) {
                    $this.removeClass('active');
                } else {
                    $this.addClass('active');
                    // Auto-remove active after animation completes
                    setTimeout(function () {
                        $this.removeClass('active');
                    }, 2000);
                }
            }

            // Prevent scroll to top by restoring position
            requestAnimationFrame(function () {
                window.scrollTo(window.scrollX, scrollY);
            });

            return false;
        });

        log('✓ Skill blocks initialized');
    }

    // ============================================
    // Smooth Scroll Handler
    // ============================================

    /**
     * Initialize smooth scrolling for anchor links
     */
    function initSmoothScroll() {
        if (typeof jQuery === 'undefined') return;

        jQuery('a[href^="#"]').on('click', function (e) {
            var href = this.getAttribute('href');
            // Skip if href is just "#" (no target)
            if (!href || href === '#' || href.length <= 1) return;

            var target = jQuery(href);

            if (target.length) {
                e.preventDefault();
                jQuery('html, body').animate({
                    scrollTop: target.offset().top - 100
                }, 600);
            }
        });

        log('✓ Smooth scroll initialized');
    }

    // ============================================
    // Animation Helpers
    // ============================================

    /**
     * Initialize scroll-triggered animations
     */
    function initScrollAnimations() {
        if (typeof jQuery === 'undefined') return;

        // Check if elements are in viewport
        function isInViewport(element) {
            var rect = element.getBoundingClientRect();
            return (
                rect.top >= 0 &&
                rect.left >= 0 &&
                rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
                rect.right <= (window.innerWidth || document.documentElement.clientWidth)
            );
        }

        // Animate elements on scroll
        function checkScrollAnimations() {
            jQuery('.animate-on-scroll').each(function () {
                var $el = jQuery(this);
                if (!$el.hasClass('animated') && isInViewport(this)) {
                    $el.addClass('animated');
                }
            });
        }

        // Run on scroll and on load
        jQuery(window).on('scroll', checkScrollAnimations);
        checkScrollAnimations();

        log('✓ Scroll animations initialized');
    }

    // ============================================
    // Form Enhancement
    // ============================================

    /**
     * Enhance form interactions
     */
    function initForms() {
        if (typeof jQuery === 'undefined') return;

        // Add focus/blur effects to form inputs
        jQuery('.form-input').on('focus', function () {
            jQuery(this).closest('.form-block').addClass('input-focused');
        }).on('blur', function () {
            if (!jQuery(this).val()) {
                jQuery(this).closest('.form-block').removeClass('input-focused');
            }
        });

        // Handle form submission with EmailJS (works client-side, no server needed)
        jQuery('#email-form').on('submit', function (e) {
            e.preventDefault();

            var $form = jQuery(this);
            var $button = jQuery('#submit-btn');
            var originalValue = $button.val();
            var $successMsg = jQuery('#success-message');
            var $errorMsg = jQuery('#error-message');

            // Get form values
            var name = jQuery('#name').val();
            var email = jQuery('#email').val();
            var message = jQuery('#message').val();

            // Show loading state
            $button.val('Sending...').prop('disabled', true);
            $successMsg.hide();
            $errorMsg.hide();

            // Check if EmailJS is loaded
            if (typeof emailjs === 'undefined') {
                $errorMsg.show();
                $button.val(originalValue).prop('disabled', false);
                alert('Email service not configured. Please set up EmailJS with your public key.');
                return;
            }

            // EmailJS service configuration
            var serviceId = 'service_9ev801i'; // Your Service ID from EmailJS
            var templateId = 'template_um013l4'; // Your Template ID from EmailJS
            var publicKey = '5VHngTIbvXsUizZvl'; // Your Public Key from EmailJS Account

            // If keys are not set, show instructions (this should not trigger now)
            if (!serviceId || !templateId || !publicKey || templateId === 'YOUR_TEMPLATE_ID' || publicKey === 'YOUR_PUBLIC_KEY') {
                $button.val(originalValue).prop('disabled', false);
                alert('Please configure EmailJS:\n\n1. Sign up at https://www.emailjs.com/\n2. Create an email service\n3. Create an email template\n4. Update the keys in FrontEnd.js\n\nFor now, using mailto as fallback...');

                // Fallback to mailto
                var mailtoLink = 'mailto:santhoshratnam1@gmail.com?subject=Contact Form: ' + encodeURIComponent(name) + '&body=' + encodeURIComponent('Name: ' + name + '\nEmail: ' + email + '\n\nMessage:\n' + message);
                window.location.href = mailtoLink;
                return;
            }

            // Initialize EmailJS with public key
            emailjs.init(publicKey);

            // Prepare email parameters
            var templateParams = {
                from_name: name,
                from_email: email,
                message: message,
                to_email: 'santhoshratnam1@gmail.com'
            };

            // Send email via EmailJS
            emailjs.send(serviceId, templateId, templateParams)
                .then(function (response) {
                    // Success
                    // Hide form inputs and button
                    jQuery('#name, #email, #message, #submit-btn').slideUp(300, function () {
                        jQuery(this).hide();
                    });

                    // Show success message
                    $successMsg.slideDown(300);
                    $form[0].reset();
                    $button.val(originalValue).prop('disabled', false);

                    // Scroll to success message
                    jQuery('html, body').animate({
                        scrollTop: $successMsg.offset().top - 100
                    }, 500);
                }, function (error) {
                    // Error
                    console.error('EmailJS error:', error);
                    $errorMsg.show();
                    $button.val(originalValue).prop('disabled', false);

                    // Fallback to mailto on error
                    var mailtoLink = 'mailto:santhoshratnam1@gmail.com?subject=Contact Form: ' + encodeURIComponent(name) + '&body=' + encodeURIComponent('Name: ' + name + '\nEmail: ' + email + '\n\nMessage:\n' + message);
                    alert('Email service error. Opening your email client as fallback...');
                    window.location.href = mailtoLink;
                });
        });

        log('✓ Forms enhanced');
    }

    // ============================================
    // Performance Optimizations
    // ============================================

    /**
     * Optimize images loading
     */
    function initImageOptimization() {
        // Lazy load images if not already handled
        if ('loading' in HTMLImageElement.prototype) {
            var images = document.querySelectorAll('img[loading="lazy"]');
            images.forEach(function (img) {
                img.src = img.dataset.src || img.src;
            });
        }

        log('✓ Image optimization initialized');
    }

    // ============================================
    // Main Initialization
    // ============================================

    /**
     * Initialize everything when DOM is ready
     */
    function init() {
        log('Starting FrontEnd initialization...');

        // Check dependencies
        if (!checkjQuery()) {
            log('ERROR: jQuery is required but not loaded!');
            return;
        }

        // Wait for DOM to be ready
        jQuery(document).ready(function () {
            log('DOM ready, initializing components...');

            // Initialize fonts first
            initFonts();

            // Initialize animations
            initAnimations();

            // Initialize components with delay to ensure animations are ready
            setTimeout(function () {
                initMobileMenu();
                initSkillBlocks();
                initSmoothScroll();
                initScrollAnimations();
                initForms();
                initImageOptimization();

                log('✓ All components initialized');

                // Trigger custom ready event
                jQuery(document).trigger('frontend:ready');
            }, config.animationDelay);
        });
    }

    // ============================================
    // Start Initialization
    // ============================================

    // Start initialization when script loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // DOM already loaded
        init();
    }

    // Also initialize on window load as backup
    window.addEventListener('load', function () {
        setTimeout(function () {
            if (checkAnimEngine()) {
                log('✓ AnimEngine confirmed ready on window load');
            }
        }, 100);
    });

    // Testimonials Modal Functionality
    const testimonialsItem = document.querySelectorAll("[data-testimonials-item]");
    const modalContainer = document.querySelector("[data-modal-container]");
    const modalCloseBtn = document.querySelector("[data-modal-close-btn]");
    const overlay = document.querySelector("[data-overlay]");
    const modalImg = document.querySelector("[data-modal-img]");
    const modalTitle = document.querySelector("[data-modal-title]");
    const modalText = document.querySelector("[data-modal-text]");

    // Modal toggle function
    const testimonialsModalFunc = function () {
        if (modalContainer && overlay) {
            modalContainer.classList.toggle("active");
            overlay.classList.toggle("active");
        }
    };

    // Add click event to all modal items
    if (testimonialsItem.length > 0) {
        testimonialsItem.forEach(item => {
            item.addEventListener("click", function () {
                if (modalImg && modalTitle && modalText) {
                    const avatar = this.querySelector("[data-testimonials-avatar]");
                    const title = this.querySelector("[data-testimonials-title]");
                    const text = this.querySelector("[data-testimonials-text]");

                    if (avatar) {
                        modalImg.src = avatar.src;
                        modalImg.alt = avatar.alt;
                    }
                    if (title) {
                        modalTitle.innerHTML = title.innerHTML;
                    }
                    if (text) {
                        modalText.innerHTML = text.innerHTML;
                    }
                    testimonialsModalFunc();
                }
            });
        });
    }

    // Add click event to modal close button
    if (modalCloseBtn) {
        modalCloseBtn.addEventListener("click", testimonialsModalFunc);
    }

    // Add click event to overlay
    if (overlay) {
        overlay.addEventListener("click", testimonialsModalFunc);
    }

})();

// Levels Toggle Functionality
(function initLevelsToggle() {
    if (!document.body.dataset.levelsToggleInitialized) {
        // Use event delegation on document to catch all toggle buttons (including dynamically added ones)
        document.addEventListener('click', function (e) {
            if (e.target.closest('.levels-toggle-btn')) {
                const btn = e.target.closest('.levels-toggle-btn');
                btn.classList.toggle('active');
                const levelsSection = btn.nextElementSibling;
                if (levelsSection && levelsSection.classList.contains('project-levels-section')) {
                    levelsSection.classList.toggle('active');
                }
            }
        });

        document.body.dataset.levelsToggleInitialized = 'true';
        console.log('✅ Levels toggle functionality initialized');
    }
})();

