This is my custom system for live polling an audience, put together with Gemini.

Feel free to copy it.

1. Create a [Firebase](https://console.firebase.google.com) project. No need for analytics. In there:
2. Allow authentication with Google and as Anonymous user.
3. Create a NoSQL Firestore database (not a Realtime Database): free tier should be plenty enough with this.
4. Set the access rules (reach out to me).
5. Under Security -> Setting -> Authorized domains, make sure to include the domain from where your webpages will be served (include localhost and 127.0.0.1 while testing).
6. Copy the files from this repo and serve them from wherever (e.g., using Github Pages).
7. In each file, look for "PASTE YOUR FIREBASE CONFIG HERE": copy your data there (provided by Firebase, under Settings -> General).

Usage should be self explanatory.


Side notes:

* Under Security -> Settings -> Sign-up quota, you will see that Firebase limits "the number of new Email/Password and Anonymous accounts that your application can create in a day from a single IP address". This may create friction with hundreds students in a lecture room, connected on the same WiFi: they might have the same IP address. The client side webpage should instruct users to temporarily switch to cellular data if that happens (once they are logged in, it's fine: they can go back to WiFi). That said, you can also increase the quota ahead of the first lecture. The change only lasts for a few days though, and may take an hour to kick in.
