<script>
	import { goto } from '$app/navigation';

	let { value = '' } = $props();
	let uid = $state(value);

	// reflect the current profile's UID (passed from the route) into the box
	$effect(() => {
		uid = value;
	});

	function submit(e) {
		e.preventDefault();
		const v = uid.trim();
		if (!v) return;
		goto(`/${v}`);
	}
</script>

<form class="uid-form" onsubmit={submit}>
	<input
		inputmode="numeric"
		pattern="[0-9]{'{'}9,10{'}'}"
		placeholder="UID · e.g. 800333171"
		required
		bind:value={uid}
	/>
	<button>View</button>
</form>
