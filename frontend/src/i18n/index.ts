import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      welcome: 'Aurora POS',
      login: 'Login',
      username: 'Username',
      password: 'Password',
      logout: 'Logout',
      searchProducts: 'Search products or scan barcode',
      barcodePlaceholder: 'Scan or type barcode',
      cart: 'Cart',
      quantity: 'Qty',
      price: 'Price',
      discount: 'Discount',
      total: 'Total',
      checkout: 'Checkout',
      removeItem: 'Remove item',
      clearCart: 'Clear cart',
      receiptPreview: 'Receipt preview',
      changeLanguage: 'العربية',
      darkMode: 'Dark mode',
      lightMode: 'Light mode',
      analytics: 'Analytics',
      backToPos: 'Back to POS',
      profitLeaders: 'Top profit SKUs',
      lossLeaders: 'Loss leaders',
      markdownRecovery: 'Markdown recovery',
      currencyMix: 'Tender mix',
      changeIssuance: 'Change issuance',
      dailySales: 'Daily sales (USD)',
      seasonalForecast: 'Seasonal forecast',
      currencyMixTrend: 'Currency mix over time',
      changeIssuanceTrend: 'Change issuance trend',
      profitMargins: 'Profit margins',
      product: 'Product',
      marginPercent: 'Margin %',
      revenue: 'Revenue',
      loadingAnalytics: 'Loading analytics…',
      analyticsError: 'Unable to load analytics. Showing demo data.',
      forecastFor: 'Forecast for'
    }
  },
  ar: {
    translation: {
      welcome: 'أورورا لنقاط البيع',
      login: 'تسجيل الدخول',
      username: 'اسم المستخدم',
      password: 'كلمة المرور',
      logout: 'تسجيل الخروج',
      searchProducts: 'ابحث عن المنتجات أو امسح الباركود',
      barcodePlaceholder: 'امسح أو اكتب الباركود',
      cart: 'السلة',
      quantity: 'الكمية',
      price: 'السعر',
      discount: 'خصم',
      total: 'الإجمالي',
      checkout: 'إتمام الدفع',
      removeItem: 'إزالة العنصر',
      clearCart: 'تفريغ السلة',
      receiptPreview: 'معاينة الإيصال',
      changeLanguage: 'English',
      darkMode: 'الوضع الداكن',
      lightMode: 'الوضع الفاتح',
      analytics: 'التحليلات',
      backToPos: 'العودة إلى نقطة البيع',
      profitLeaders: 'أعلى المنتجات ربحية',
      lossLeaders: 'المنتجات الخاسرة',
      markdownRecovery: 'استرداد التخفيضات',
      currencyMix: 'مزيج العملات',
      changeIssuance: 'صرف الباقي',
      dailySales: 'المبيعات اليومية (دولار)',
      seasonalForecast: 'التوقع الموسمي',
      currencyMixTrend: 'تطور مزيج العملات',
      changeIssuanceTrend: 'تطور صرف الباقي',
      profitMargins: 'هوامش الربح',
      product: 'المنتج',
      marginPercent: 'نسبة الهامش',
      revenue: 'الإيراد',
      loadingAnalytics: 'جاري تحميل التحليلات…',
      analyticsError: 'تعذر تحميل التحليلات. يتم عرض بيانات تجريبية.',
      forecastFor: 'توقع لـ'
    }
  }
};

i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false
  }
});

export default i18n;
