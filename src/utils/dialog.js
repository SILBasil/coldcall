import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';

const basePopupClass = 'rounded-3xl border border-slate-100 shadow-2xl p-6 font-sans bg-white';
const baseTitleClass = 'text-lg font-black text-slate-800 uppercase italic tracking-tight';
const baseHtmlClass = 'text-sm font-bold text-slate-500 leading-relaxed mt-2 whitespace-pre-wrap';

export const dialog = {
  /**
   * Show a beautiful confirmation dialog.
   * @param {Object} options
   * @param {string} options.title - The title of the confirmation.
   * @param {string} options.text - The description or warning text.
   * @param {string} [options.icon='warning'] - SweetAlert2 icon type ('warning', 'error', 'success', 'info', 'question').
   * @param {string} [options.confirmText='ตกลง'] - Confirm button label.
   * @param {string} [options.cancelText='ยกเลิก'] - Cancel button label.
   * @param {boolean} [options.isDanger=false] - If true, style the confirm button as a danger button (red/rose).
   * @returns {Promise<boolean>} Resolves to true if confirmed, false otherwise.
   */
  async confirm({ title, text, icon = 'warning', confirmText = 'ตกลง', cancelText = 'ยกเลิก', isDanger = false }) {
    const result = await Swal.fire({
      title,
      html: text,
      icon,
      showCancelButton: true,
      confirmButtonText: confirmText,
      cancelButtonText: cancelText,
      buttonsStyling: false,
      customClass: {
        popup: basePopupClass,
        title: baseTitleClass,
        htmlContainer: baseHtmlClass,
        confirmButton: `px-6 py-3 text-white rounded-2xl text-xs font-black shadow-md border-none cursor-pointer active:scale-95 transition-all mr-2 outline-none ${
          isDanger 
            ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-100 focus:ring-2 focus:ring-rose-500' 
            : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100 focus:ring-2 focus:ring-indigo-500'
        }`,
        cancelButton: 'px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl text-xs font-black border-none cursor-pointer active:scale-95 transition-all ml-2 outline-none focus:ring-2 focus:ring-slate-300',
      }
    });
    return result.isConfirmed;
  },

  /**
   * Show a beautiful alert dialog.
   * @param {Object} options
   * @param {string} options.title - The title of the alert.
   * @param {string} options.text - The message text.
   * @param {string} [options.icon='info'] - SweetAlert2 icon type.
   * @param {string} [options.confirmText='ตกลง'] - Button label.
   * @returns {Promise<void>}
   */
  async alert({ title, text, icon = 'info', confirmText = 'ตกลง' }) {
    await Swal.fire({
      title,
      html: text,
      icon,
      confirmButtonText: confirmText,
      buttonsStyling: false,
      customClass: {
        popup: basePopupClass,
        title: baseTitleClass,
        htmlContainer: baseHtmlClass,
        confirmButton: 'px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black shadow-md border-none cursor-pointer active:scale-95 transition-all outline-none focus:ring-2 focus:ring-indigo-500',
      }
    });
  },

  /**
   * Show a beautiful text input prompt dialog.
   * @param {Object} options
   * @param {string} options.title - The title of the prompt.
   * @param {string} options.text - The message text.
   * @param {string} [options.placeholder=''] - Input placeholder.
   * @param {string} [options.confirmText='ตกลง'] - Confirm button label.
   * @param {string} [options.cancelText='ยกเลิก'] - Cancel button label.
   * @param {Function} [options.inputValidator] - Custom validation function.
   * @returns {Promise<string|null>} Resolves to the input text value, or null if cancelled.
   */
  async prompt({ title, text, placeholder = '', confirmText = 'ตกลง', cancelText = 'ยกเลิก', inputValidator }) {
    const result = await Swal.fire({
      title,
      html: text,
      input: 'text',
      inputPlaceholder: placeholder,
      showCancelButton: true,
      confirmButtonText: confirmText,
      cancelButtonText: cancelText,
      buttonsStyling: false,
      inputValidator,
      customClass: {
        popup: basePopupClass,
        title: baseTitleClass,
        htmlContainer: baseHtmlClass,
        input: 'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-indigo-500 outline-none mt-3 mb-1 font-sans',
        confirmButton: 'px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black shadow-md border-none cursor-pointer active:scale-95 transition-all mr-2 outline-none focus:ring-2 focus:ring-indigo-500',
        cancelButton: 'px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl text-xs font-black border-none cursor-pointer active:scale-95 transition-all ml-2 outline-none focus:ring-2 focus:ring-slate-300',
      }
    });
    return result.value || null;
  }
};
