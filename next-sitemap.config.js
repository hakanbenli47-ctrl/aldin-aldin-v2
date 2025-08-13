/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: 'https://80bir.com.tr', // <-- burayı doldur
  generateRobotsTxt: true,
  sitemapSize: 5000,
  exclude: ['/api/*'], // opsiyonel: API yollarını dışla
};
