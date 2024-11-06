Created by [@futurGH](https://gist.github.com/futurGH/e57331e29cf9330d6c676ca75c597847)

This will create a list from an accounts follows.

1. Create an app password
2. Fill in all the `...` in the script -- the account handle, app password, and then the account you want to create a list from their following
3. Run with `node followsToList.js`

You should get output that looks like this:

```
Fetched list.
Fetched list items.
Fetched follows for atprotocol.dev.
Added 25 follows to list.
Added 25 follows to list.
Added 25 follows to list.
...
...
List created or updated from atprotocol.dev's follows at https://bsky.app/profile/atprotocol.dev/lists/(list ID)
```

You can re-run the script to update it.