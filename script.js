const form = document.querySelector("#secretForm");
const input = document.querySelector("#secretPhrase");
const errorMessage = document.querySelector("#errorMessage");
const secretPhrase = "Pllugi1234";

if (form) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();

    if (input.value === secretPhrase) {
      window.location.href = "grid.html";
      return;
    }

    errorMessage.textContent = "Incorrect secret phrase.";
    input.value = "";
    input.focus();
  });
}
