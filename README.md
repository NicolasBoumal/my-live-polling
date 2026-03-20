# Schoen Poll

This is my custom system for live polling an audience, put together with Gemini.

Feel free to copy it.

 -- Nicolas Boumal, March 2026


## Setup

Create a [Firebase](https://console.firebase.google.com) project. No need for analytics.

In there:

1. Allow authentication both with Google and as Anonymous user.
2. Create a NoSQL Firestore database (not a Realtime Database): free tier should be plenty enough with this.
3. Set the access rules (see below).
4. Under Security -> Setting -> Authorized domains, make sure to include the domain from where your webpages will be served (include localhost and 127.0.0.1 for local testing).

Then:

5. Copy the files from this repo and serve them from wherever (e.g., using Github Pages).
6. In `config.js`, copy your Firebase config data (provided by Firebase under Settings -> General).
7. In `config.js`, also update `clickerUrl` with the URL to your clicker (the `index.html` page).
8. That's also where you can edit the bubble colors.

Usage should be self explanatory. In a nutshell:

* Open the `admin.html` page on your phone: that's the remote.
* Have participants open the `index.html` page on their devices: that's the clicker.
* Open `results.html` on your lecture screen.
* Alternatively, look inside `results.html` and copy its relevant code to your setup: perfect for a [revealjs](https://revealjs.com/)-style presentation!
* The `history.html` page displays past questions and answers.


## Side notes

* In Firebase, under Security -> Settings -> Sign-up quota, you will see that Firebase limits "the number of new Email/Password and Anonymous accounts that your application can create in a day from a single IP address". This may create friction with hundreds students in a lecture room, connected on the same WiFi: they might have the same IP address. The client side webpage should instruct users to temporarily switch to cellular data if that happens (once they are logged in, it's fine: they can go back to WiFi). That said, you can also increase the quota ahead of the first lecture. The change only lasts for a few days though, and may take an hour to kick in.

* To display the results, you need to be logged in as an admin. If somehow this isn't the case on the machine that should display the results, do this: (1) open the remote (`admin.html`), (2) in the extra options below, click the log out button, and (3) log in again, making sure to use your admin account. (4) Reload the page that displays the results.

* The `results.html` page can be included as a "browser" source in [OBS](https://obsproject.com/): it will make the background transparent. This provides a means to overlay the vote bubbles and the QR code on top of your powerpoint / keynote / iPad goodnotes / ... seamlessly, still controlled by the admin remote (on your phone). The overlay only appears on the screen you share or on the virtual camera, so the presenter view stays clean.


## Firebase access rules

Set these rules through the Firebase console: select your Firestore in the left pane, then click "Rules" in the horizontal menu. Edit and publish.

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // List one or more admins here.
    function isAdmin() {
      return request.auth != null && 
             request.auth.token.email in ["first-admin@gmail.com", "second-admin@gmail.com"];
    }

    // 1. The Live State: everyone can read it, only admins can change it.
    //    This allows the clicker to show the buttons immediately, while silent
    //    authentication runs in the background
    match /state/live {
      allow read: if true;
      allow write: if isAdmin();
    }
    
    // 2. The Presence sheet: users can manage their own, admins have full access to count/reset.
    match /presence/{userId} {
      allow read, write: if isAdmin() || (request.auth != null && request.auth.uid == userId);
    }

    // 3. The Answers: users can only edit their own answer. Admins have full access.
    match /questions/{questionId}/answers/{userId} {
      allow read, write: if isAdmin() || (request.auth != null && request.auth.uid == userId);
    }

    // 4. The Question History: only admins can record questions and tallies.
    match /questions/{questionId} {
      allow read, write: if isAdmin();
    }
  }
}
```
