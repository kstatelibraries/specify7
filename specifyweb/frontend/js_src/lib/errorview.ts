import Backbone from './backbone';
import commonText from './localization/common';
import { clearUnloadProtect } from './navigation';

// TODO: rewrite this to react
export const ErrorView = Backbone.View.extend({
  __name__: 'ErrorView',
  render() {
    this.el.innerHTML = `
      <h3>${this.options.header}</h3>
      <p>${this.options.message}</p>
    `;
  },
});

export const UnhandledErrorView = Backbone.View.extend({
  __name__: 'UnhandledErrorView',
  title: commonText('backEndErrorDialogTitle'),
  render() {
    this.el.innerHTML = `
      ${commonText('backEndErrorDialogHeader')} 
      <p>${commonText('backEndErrorDialogMessage')}</p>
      <textarea readonly class="w-full min-h-[600px]">
        ${this.options.response}
      </textarea>
    `;
    // TODO: when transitioning to react <Dialog>, add "forceToTop={true}" prop
    this.$el.dialog({
      modal: true,
      width: '800',
      dialogClass: 'ui-dialog-no-close',
      buttons: [
        {
          text: commonText('close'),
          click() {
            window.location.href = '/';
          },
        },
        ...(process.env.NODE_ENV === 'production'
          ? []
          : [
              {
                text: '[development] dismiss',
                click: () => this.remove(),
              },
            ]),
      ],
    });
    clearUnloadProtect();
  },
});
