import { LinkButton, Nav } from "@/ui";

export default function LandingPage() {
  return (
    <>
      <Nav
        actions={
          <LinkButton href="/login" variant="ghost" size="sm">
            Log in
          </LinkButton>
        }
      />
      <main className="mx-auto flex max-w-3xl flex-col items-center px-6 pt-28 pb-24 text-center sm:pt-36">
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
          Outbound sales that sounds like you.
        </h1>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-pretty text-muted sm:text-lg">
          Describe your business and who you want to reach. AI agents find the right people, research each one, write a
          short personal email, and send it from your own mailbox, within safe limits. They stop the moment someone
          replies.
        </p>
        <LinkButton href="/signup" size="lg" className="mt-10">
          Get started
        </LinkButton>
      </main>
    </>
  );
}
