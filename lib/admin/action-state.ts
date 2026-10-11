/**
 * What an admin form's server action answers, shown under the form by
 * ActionForm (components/admin/ActionForm.tsx). A thrown error shows the
 * error page instead, and in production hides its message, so an action
 * whose failure the admin needs to read returns { error } rather than throw.
 */
export interface ActionState {
  error?: string;
  ok?: string;
}
