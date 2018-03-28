
document.getElementById("failed-query-display").style.display = 'none';
window.onload = setUpSearchForm;
var KEY="YOUR-QNA-MAKER-KEY";


function post() {
    var qn = document.getElementById("question").value;
    $.ajax({
      type: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Ocp-Apim-Subscription-Key": KEY
      },
      url: "https://westus.api.cognitive.microsoft.com/qnamaker/v2.0/knowledgebases/63193b1b-4439-4c2d-83c3-ca9d8b5321db/generateAnswer",
      contentType: "application/x-www-form-urlencoded",
      data: {"question": qn},
      dataType: 'json',
      success: handleResponse
    });
}

function setUpSearchForm() {
  $('#searchForm').submit(function(e){ //to prevent form from redirecting
     e.preventDefault();
     post();
  });
}


function showQuery(questionID) {
  questionSet = document.getElementsByTagName("li");
  for (i=0; i<questionSet.length; i++) {
    if (questionSet[i].id != questionID) { //hide the rest of the questions
      questionSet[i].style.display = 'none';
    } else {
      questionSet[i].style.display = "block";
    }
  }
}

function showInvalidQuestionQuery() {
  document.getElementById("failed-query-display").style.display = 'block'; //show tag to show response for failed query
  document.getElementById("failed-query-display").innerHTML = "Sorry, no such question was found.";
  questionSet = document.getElementsByTagName("li");
  for (i=0; i<questionSet.length; i++) {
    questionSet[i].style.display = 'block';
  };
}

function handleResponse(query_response) {
  document.getElementById("failed-query-display").style.display = 'none'; //hides the tag to prevent an ugly space
  response = query_response["answers"][0]["answer"];
  switch(response) {
    case "No good match found in the KB":
      showInvalidQuestionQuery();
      break;
    case "Currently, we support Dropbox, OneDrive and Google Drive.":
      showQuery("cloud-storage");
      break;
    case "Unlimited!":
      showQuery("entries");
      break;
    case "Our logins are based on Microsoft accounts, so please create a Microsoft account.":
      showQuery("account");
      break;
    case "The application looks at the new food pictures you uploaded into your cloud (i.e. Dropbox etc) and analyse the picture to automatically create a card post.":
      showQuery("application-work");
      break;
    case "Sure! At the bottom of each post, there will be an icon for you to do so.":
      showQuery("edit-card");
      break;
    case "Yes, we only store the data which we require such as the pictures to generate the card post. When you delete your account, our server automatically wipes all the data associated with your account.":
      showQuery("security");
      break;
  }
}
