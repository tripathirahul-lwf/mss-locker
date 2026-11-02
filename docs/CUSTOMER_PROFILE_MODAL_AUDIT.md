# Customer profile modal audit

Fixed focus-effect resets caused by changing parent callbacks, added independent scroll locking, corrected focus wrapping from the dialog itself, and guarded edit/KYC/invoice actions by permissions and successful profile loading. Restricted or failed requests no longer display a cached customer name in the header.

Date of birth uses the India timezone and rejects invalid date values. Gender and account status use readable casing. Imported profile placeholders and recorded KYC status remain unmodified, with a visible explanation that recorded verification does not prove current digital document availability.

UI uses the shared light surface, rounded corners, readable labels and values, responsive scrolling, and green edit action.

Guidance: [W3C modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) for keyboard containment, initial focus and focus restoration.

Validation: frontend build and desktop/mobile customer-profile workflows, including edit/save, focus wrap, scroll locking and same-page navigation.
