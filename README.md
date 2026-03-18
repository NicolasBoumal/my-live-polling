# Schoen Poll

This is my custom system for live polling an audience, put together with Gemini.

Feel free to copy it.

 -- Nicolas Boumal, March 2026

## Setup

Create a [Firebase](https://console.firebase.google.com) project. No need for analytics.

In there:

1. Allow authentication both with Google and as Anonymous user.
2. Create a NoSQL Firestore database (not a Realtime Database): free tier should be plenty enough with this.
3. Set the access rules (reach out to me).
4. Under Security -> Setting -> Authorized domains, make sure to include the domain from where your webpages will be served (include localhost and 127.0.0.1 for local testing).

Then:

5. Copy the files from this repo and serve them from wherever (e.g., using Github Pages).
6. In `config.js`, copy your Firebase config data (provided by Firebase under Settings -> General).
7. In `config.js`, also update `clickerUrl` with the URL to your clicker (the `index.html` page).

Usage should be self explanatory. In a nutshell:

* Open the `admin.html` page on your phone: that's the remote.
* Have participants open the `index.html` page on their devices: that's the clicker.
* Open `results.html` on your lecture screen.
* Alternatively, look inside `results.html` and copy its relevant code to your setup: perfect for a [revealjs](https://revealjs.com/)-style presentation!


## Side notes

* In Firebase, under Security -> Settings -> Sign-up quota, you will see that Firebase limits "the number of new Email/Password and Anonymous accounts that your application can create in a day from a single IP address". This may create friction with hundreds students in a lecture room, connected on the same WiFi: they might have the same IP address. The client side webpage should instruct users to temporarily switch to cellular data if that happens (once they are logged in, it's fine: they can go back to WiFi). That said, you can also increase the quota ahead of the first lecture. The change only lasts for a few days though, and may take an hour to kick in.
