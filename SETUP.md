# Setting up drinpiN's database (Supabase)

This takes about 20 minutes and you only do it once. You don't need to install anything; everything happens in your web browser.

Until you finish, drinpiN still works, saving on each person's phone. After you finish, people can sign in, and their saves are backed up and synced across their devices.

---

## 1. Create a Supabase project

1. Go to <https://supabase.com> and sign up. The free plan is fine to start with.
2. Click **New project**.
   - **Name:** `drinpin`
   - **Database password:** use the generate button and store the password somewhere safe. The app doesn't need it.
   - **Region:** **Mumbai (ap-south-1)** if most of your users are in India. Choosing the closest region makes the app faster.
3. Wait about a minute for the project to be ready.

## 2. Create the database table

1. In the left menu, open **SQL Editor** and click **New query**.
2. Open [`supabase/schema.sql`](supabase/schema.sql) in this repository and copy all of it.
3. Paste it into the editor and click **Run**. You should see "Success. No rows returned".

This creates the `outfits` table and its security rules: **each person can only ever see and change their own saves**, and logged-out visitors can't read anything. The rules are tested automatically (`tests/schema.test.ts`).

## 3. Make sign-in emails send a 6-digit code

drinpiN signs people in with a code sent by email, so there's no password to forget. A code is used rather than a link because a link in an email opens the phone's browser instead of the installed app.

1. Go to **Authentication → Emails** (it may be called **Email Templates**).
2. Open the **Magic Link** template and replace the message with:

   ```html
   <h2>Your drinpiN sign-in code</h2>
   <p>Enter this code in drinpiN:</p>
   <p style="font-size:28px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
   <p>Or <a href="{{ .ConfirmationURL }}">tap here to sign in</a> on this device.</p>
   <p>If you didn't ask for this, you can ignore this email.</p>
   ```

   Set the **Subject** to `Your drinpiN code`.
3. Do the same for the **Confirm signup** template. Brand-new users get this one instead.
4. Test it: sign in on the live app with an email address you've never used. The email should show a 6-digit code.

## 4. Set up email sending (needed before real users arrive)

Supabase's built-in email sender is only for testing: it sends just **a few emails per hour** across your whole project. Once real people start signing in, connect a proper email service. Resend is free for 3,000 emails a month:

1. Sign up at <https://resend.com> and add and verify a domain you own. (If you don't have one, a cheap domain from any registrar works.)
2. In Resend, create an **API key**.
3. In Supabase, go to **Authentication → Emails → SMTP Settings** and turn on **Custom SMTP**:
   - **Host:** `smtp.resend.com`
   - **Port:** `465`
   - **Username:** `resend`
   - **Password:** your Resend API key
   - **Sender email:** for example `hello@yourdomain.com`
   - **Sender name:** `drinpiN`
4. Then go to **Authentication → Rate Limits** and raise the email limit, for example to 100 per hour.

## 5. Tell Supabase where the app lives

Go to **Authentication → URL Configuration**:

- **Site URL:** `https://drvptl2106.github.io/drinpin/`
- **Redirect URLs:** add `https://drvptl2106.github.io/drinpin/` and `http://localhost:5173/` (for testing on a computer).

## 6. Add the link-preview function (pictures and titles for saved links)

1. In the left menu, open **Edge Functions**.
2. Click **Deploy a new function** and choose **Via Editor**.
3. Name it exactly `link-preview`.
4. Delete the example code, then paste in everything from [`supabase/functions/link-preview/index.ts`](supabase/functions/link-preview/index.ts).
5. Click **Deploy function**.
6. In the function's settings, keep **Enforce JWT verification** turned **on**, so only signed-in drinpiN users can use it.

Instagram usually blocks previews, so Instagram saves often show a coloured tile instead of a picture. Shops (Myntra, Ajio, Amazon…), Pinterest and YouTube generally work.

## 7. Connect the app to Supabase

1. In Supabase, open **Project Settings → API Keys**, or click **Connect** at the top. Copy two things:
   - the **Project URL**, like `https://abcdefgh.supabase.co`
   - the **anon** key (it may be called **publishable** key)

   These two are safe to put in a website. The security rules from step 2 are what protect the data. **Never** copy the `service_role` or **secret** key anywhere.
2. In GitHub, open this repository's **Settings → Secrets and variables → Actions**, then switch to the **Variables** tab and click **New repository variable** twice:
   - `SUPABASE_URL` = your Project URL
   - `SUPABASE_ANON_KEY` = your anon/publishable key

## 8. Switch GitHub Pages to the new build

1. In GitHub, go to **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Merge the new version into `main`. The **Actions** tab shows it building, and about 2 minutes later it's live at <https://drvptl2106.github.io/drinpin/>.

After this, every change merged into `main` publishes itself.

---

## What existing users will see

- The address stays the same, so installed apps update themselves. Within a visit or two people see "A new version of drinpiN is ready · Update".
- **Their outfits move over automatically** on first open. Reels are no longer part of the app and aren't moved. The old data stays untouched on their phone, so nothing is lost.
- Their saves stay on their phone until they sign in. Signing in uploads them to their account.

## Optional extras

**Google sign-in**
1. Supabase: **Authentication → Sign In / Providers → Google**. Follow Supabase's guide to create a Google OAuth client, then paste its Client ID and Secret.
2. GitHub: add the repository variable `ENABLE_GOOGLE` = `true`, then re-run the **Build & deploy** action.

**Publish the preview function automatically from GitHub**
Instead of pasting it by hand (step 6) every time it changes:
1. Create a token at <https://supabase.com/dashboard/account/tokens>, and add it as a repository **secret** named `SUPABASE_ACCESS_TOKEN`.
2. Add a repository **variable** `SUPABASE_PROJECT_REF`, set to the `abcdefgh` part of your Project URL.

## Good to know

- **Free plan:** 500 MB of database, which is roughly a million outfits. Free projects **pause after a week with no visitors**; if that happens, click **Restore** in the dashboard. Upgrade to Pro ($25/month) when you rely on it.
- **Your users' data:** visible in **Table Editor → outfits**. Treat it as private.
- **Deleting a user:** **Authentication → Users → ⋯ → Delete user**. Their outfits are removed automatically.
