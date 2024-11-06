// Login information for the account where the list will be created.
const LOGIN_HANDLE = "...";
const LOGIN_PASSWORD = "...";
const LOGIN_PDS = "https://bsky.social"; // Change this if you're on a different PDS.

// The handle of the account whose following list will be converted to a list.
const FOLLOWING_ACCOUNT_HANDLE = "...";

const listName = `${FOLLOWING_ACCOUNT_HANDLE} Follows`;

// -----

const session = await fetch(`${LOGIN_PDS}/xrpc/com.atproto.server.createSession`, {
	method: "POST",
	headers: {
		"Content-Type": "application/json",
	},
	body: JSON.stringify({
		identifier: LOGIN_HANDLE,
		password: LOGIN_PASSWORD,
	}),
}).then(r => r.json());
if (!session.accessJwt || !session.did) {
	throw new Error("Failed to log in (email 2FA not supported).")
}
const { accessJwt, did: loginDid } = session;

const listUri = await getOrCreateList(listName);
console.log("Fetched list.");

const listItems = await getAllListItems(listUri);
console.log("Fetched list items.");

const follows = await getAllFollows(FOLLOWING_ACCOUNT_HANDLE);
console.log(`Fetched follows for ${FOLLOWING_ACCOUNT_HANDLE}.`);

const listMemberDidSet = new Set(listItems.map(item => item.subject.did));
const followsToAddToList = follows.filter(follow => !listMemberDidSet.has(follow.did));
const writeChunks = chunk(followsToAddToList.map(({ did }) => ({
	$type: "com.atproto.repo.applyWrites#create",
	collection: "app.bsky.graph.listitem",
	value: {
		subject: did,
		list: listUri,
		createdAt: new Date().toISOString()
	}
})));

for (const writeChunk of writeChunks) {
	await fetch(`${LOGIN_PDS}/xrpc/com.atproto.repo.applyWrites`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${accessJwt}`,
		},
		body: JSON.stringify({
			repo: loginDid,
			writes: writeChunk
		})
	});
	console.log(`Added ${writeChunk.length} follows to list.`);
}

const listRkey = listUri.split("/").slice(-1)[0];
const listUrl = `https://bsky.app/profile/${LOGIN_HANDLE}/lists/${listRkey}`;

console.log(`List created or updated from ${FOLLOWING_ACCOUNT_HANDLE}'s follows at ${listUrl}.`);

async function addDidToList(listUri, did) {
	if (!accessJwt || !loginDid) throw new Error("Not logged in.");

	const res = await fetch(`${LOGIN_PDS}/xrpc/com.atproto.repo.createRecord`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${accessJwt}`,
		},
		body: JSON.stringify({
			repo: loginDid,
			collection: "app.bsky.graph.listitem",
			record: {
				$type: "app.bsky.graph.listitem",
				subject: did,
				list: listUri,
				createdAt: new Date().toISOString()
			},
		})
	}).then(r => r.json());
	return res.uri;
}

async function getOrCreateList(name) {
	return await findListByName(name) || await createList(name);
}

async function createList(name) {
	if (!accessJwt || !loginDid) throw new Error("Not logged in.");

	const res = await fetch(`${LOGIN_PDS}/xrpc/com.atproto.repo.createRecord`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${accessJwt}`,
		},
		body: JSON.stringify({
			repo: loginDid,
			collection: "app.bsky.graph.list",
			record: {
				$type: "app.bsky.graph.list",
				name,
				purpose: "app.bsky.graph.defs#curatelist",
				createdAt: new Date().toISOString()
			},
		})
	}).then(r => r.json());
	return res.uri;
}

async function findListByName(name) {
	if (!loginDid) throw new Error("Not logged in.");
	const lists = [];
	let cursor = "";
	do {
		const res = await fetch(`https://api.bsky.app/xrpc/app.bsky.graph.getLists?limit=100&actor=${loginDid}&cursor=${cursor}`).then(r => r.json());
		cursor = res.cursor;
		lists.push(...res.lists);
	} while (cursor);

	return lists.find(l => l.name === name)?.uri;
}

async function getAllFollows(identifier) {
	const items = [];
	let cursor = "";
	do {
		const res = await fetch(`https://api.bsky.app/xrpc/app.bsky.graph.getFollows?limit=100&actor=${identifier}&cursor=${cursor}`).then(r => r.json());
		cursor = res.cursor;
		items.push(...res.follows);
	} while (cursor);
	return items;
}

async function getAllListItems(uri) {
	const items = [];
	let cursor = "";
	do {
		const res = await fetch(`https://api.bsky.app/xrpc/app.bsky.graph.getList?limit=100&list=${encodeURIComponent(uri)}&cursor=${cursor}`).then(r => r.json());
		cursor = res.cursor;
		items.push(...res.items);
	} while (cursor);
	return items;
}

function chunk(arr, size = 25) {
	return arr.reduce((chunks, item, i) => {
		const chunkIndex = Math.floor(i / size);
		(chunks[chunkIndex] ??= []).push(item);
		return chunks;
	}, []);
}