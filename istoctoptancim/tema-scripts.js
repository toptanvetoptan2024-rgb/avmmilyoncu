/*
 * istoctoptancim.com (Qukasoft "discovery" teması) – temanın kendi JS kodu.
 * Kaynak: theme/___discovery/assets/scripts.js
 * Sadece başvuru için saklanıyor; bu depoda çalıştırılmaz.
 */
$(function(){
    /* Sidebar Buttons */
    $(".btn-sidebar-user").click(function () {
        $('.op-black').toggleClass("hide").toggleClass("show");
        $('body').toggleClass("hidden-scroll");
        $('.sidebar-user').toggleClass("active");
    });
    $(".btn-sidebar-menu, .mobile-menu-close").click(function () {
        $('.op-black').toggleClass("hide").toggleClass("show");
        $('body').toggleClass("hidden-scroll");
        $('.sidebar-menu').toggleClass("active");
        $('.sidebar-menu-type-2').toggleClass("active");
    });
    $(".op-black").click(function () {
        $('.op-black').toggleClass("hide").toggleClass("show");
        if ( $(".sidebar-user").is(".active")){
            $('.sidebar-user').toggleClass("active");
            $('body').toggleClass("hidden-scroll");
        }
        if ( $(".sidebar-menu").is(".active")){
            $('.sidebar-menu').toggleClass("active");
            $('body').toggleClass("hidden-scroll");
        }
    });

    /* Sidebar Categories */
    var show_sidebar_categories = false;
    $(".btn-sidebar-categories").click(function () {
        $('.sidebar-menu .categories').slideToggle("fast");
        if (show_sidebar_categories){
            $(this).find('i').removeClass("fa-angle-up").addClass("fa-angle-down");
        }else{
            $(this).find('i').removeClass("fa-angle-down").addClass("fa-angle-up");
        }
        show_sidebar_categories = !show_sidebar_categories;
    });
    $(".btn-categories-show").click(function () {
        var id = $(this).data('id');
        $('.sidebar-menu .categories .categories-list-'+id).slideToggle("fast");
        $('.sidebar-menu-type-2 .categories .categories-list-'+id).slideToggle("fast");
    });

    var header_hover = false;
    $('.header-cart-hover').hover(function(){
        if (!header_hover){
            showCartBox();
        }
        header_hover = true;
    }, function(){
        header_hover = false;
    });
});

function showLoader(){
    $('.overlay').removeClass('d-none');
}

function hideLoader(){
    $('.overlay').addClass('d-none');
}

function showAlert(data, callback){
    var config = {
        title: data.title ? data.title : '',
        text: data.text ? data.text : '',
        icon: data.status ? data.status : '',
        timer: swal_alert_timer * 1000
    };
    if (data.buttons){
        config.buttons = true;
    }
    if (data.buttonTitle){
        config.button = data.buttonTitle;
    }
    if (!data.buttons && !data.buttonTitle){
        config.buttons = false;
    }

    config.timerProgressBar = true;
    if (data.buttonList){
        config.buttons = data.buttonList;
        swal(config).then(callback);
    }else{
        swal(config);
    }
}


function showCartBox(){
     fetchCartAjax();
}

function addCartSuccessEvent(id, page, settings, data, result){
    showCartBox();
      showAlert({
        title: LANG_HELPER.success,
        text: result.message,
        status: result.status,
        buttonList: {
            confirm: {
                text: LANG_HELPER.keepShopping,
                value: 'confirm',
                visible: true,
                className: "btn-primary btn-theme-3",
                closeModal: true
            },
            cart: {
                text: LANG_HELPER.goCart,
                value: 'cart',
                visible: true,
                className: "btn-success btn-theme-4",
                closeModal: false
            }
        }
    }, function(value) {
        if (value == 'cart'){
            window.location = SITE_CONFIG.cartUrl;
        }
    });
}

/* Kargo Fişi Ekleme */
function completeBeforePaymentStep(step){
    if (step == 1){
        if ($("*[data-payment-box-form='shipping-template'] #orderShipmentfile").length == 0) return false;
        var file = $("*[data-payment-box-form='shipping-template'] #orderShipmentfile")[0].files[0];
        if (file === undefined) return false;
        var files = new FormData();
        files.append('shipment_file', file);
        ajaxFormGate(
            'POST', 'Payment', 'shipmentFile', files, false, function(result){

            }, false
        );
    }
    return true;
}

/* Footer Menü Toogle */
function mobileFooterToggle(cls1){
    if ($(document).width() < 991) {
          $('.f'+cls1).toggle()
    }
}
