'use strict';
const WizardScene = require('telegraf/scenes/wizard');
const extractDomain = require('extract-domain');
const { Product } = require('../../models');
const http = require('../../helpers/http');
const validator = require('../../helpers/validator');
const AmazonProductPage = require('../../amazon/amazon-product-page');

const steps = [
  async ctx => {
    await ctx.reply('¿Podría indicarme el nombre del producto?');

    ctx.wizard.next();
  },
  async ctx => {
    const name = ctx.update.message.text;
    const user = ctx.update.message.from.id;
    const exists = await Product.exists({ name: name, user: user });

    if (exists) {
      return await ctx.reply(
        'Ya tienes un producto con el mismo nombre. Elija otro o use / salga para salir.'
      );
    }

    await ctx.reply('Inserte la URL del producto en Amazon, puede utilizar la aplicación');

    ctx.wizard.state.name = name;
    ctx.wizard.next();
  },
  async ctx => {
    const message = ctx.update.message.text;
    const urls = message.match(/\bhttps?:\/\/\S+/gi);

    if (!urls) {
      return await ctx.reply(('No se encontró ninguna URL, inténtelo de nuevo o use / salir para salir.');
    }

    const url = urls[0];
    const domain = extractDomain(url);

    if (!validator.isUrl(url) || !domain.startsWith('amazon.')) {
      return await ctx.reply('Este no es un producto válido de Amazon, inténtelo de nuevo o use / salga para salir.');
    }

    await ctx.reply('Buscando información del producto...');

    const html = await http.get(url);
    const productPage = new AmazonProductPage(html);

    const product = {
      name: ctx.wizard.state.name,
      url: url,
      user: ctx.update.message.from.id,
      price: productPage.price,
      currency: productPage.currency,
      availability: productPage.availability,
      lastCheck: Math.floor(Date.now() / 1000)
    };

    await new Product(product).save();
    await ctx.reply('¡Houston! Excelentes Noticias, encontramos su producto.');
    await ctx.scene.leave();
  }
];

const scene = new WizardScene('add-product', ...steps);

scene.command('exit', async ctx => {
  await ctx.scene.leave();
  await ctx.reply('Su producto no pudo ser agregado.');
});

module.exports = scene;
