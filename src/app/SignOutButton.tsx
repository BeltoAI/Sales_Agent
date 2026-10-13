import { buttonStyles } from "@/ui";

export function SignOutButton() {
  return (
    <form action="/auth/signout" method="post">
      <button type="submit" className={buttonStyles({ variant: "ghost", size: "sm" })}>
        Log out
      </button>
    </form>
  );
}
