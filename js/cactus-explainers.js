if (!!$.prototype.justifiedGallery) {
  var options = {
    rowHeight: 140,
    margins: 4,
    lastRow: "justify"
  };
  $(".article-gallery").justifiedGallery(options);
}

$(window).on("load", function() {
  $("#wrapper").fadeTo("slow", 1);
  $("#blogtitel").fadeOut(2000);
});

$(document).ready(function() {
  $(window).on("scroll", function() {
    var banner = $(".banner")[0];
    var wrapper = $(".wrapper")[0];
    if (!banner || !wrapper) return;

    var rect = banner.getBoundingClientRect();
    var ratio = rect.bottom / (rect.bottom - rect.top);
    var z = Math.max(0.01, Math.min(1, ratio * 0.5 + 0.5));

    wrapper.style.zoom = z;
    wrapper.style.MozTransform = "scale(" + z + ")";
  });

  $("#header > #nav > ul > .icon").click(function() {
    $("#header > #nav > ul").toggleClass("responsive");
  });

  if ($(".post").length && $("#footer-post").length) {
    var lastScrollTop = 0;
    $(window).on("scroll", function() {
      var topDistance = $(window).scrollTop();

      if (topDistance > lastScrollTop) {
        $("#footer-post").hide();
      } else {
        $("#footer-post").show();
      }
      lastScrollTop = topDistance;

      $("#toc-footer").hide();
      $("#share-footer").hide();

      if (topDistance < 50) {
        $("#actions-footer > ul > #top").hide();
      } else if (topDistance > 100) {
        $("#actions-footer > ul > #top").show();
      }
    });
  }

  var sidenotes = document.querySelector(".sidenotes");
  if (sidenotes) {
    var footnotes = Array.prototype.slice.call(document.querySelectorAll(".footnotes .footnote-item"));
    var addedNotes = 0;
    footnotes.forEach(function(note) {
      var clone = note.cloneNode(true);
      var backref = clone.querySelector(".footnote-backref");
      if (backref) backref.remove();
      clone.removeAttribute("id");
      clone.className = "sidenote";
      clone.setAttribute("data-footnote-id", note.id);
      sidenotes.appendChild(clone);
      addedNotes += 1;
    });

    var referenceLinks = Array.prototype.slice.call(document.querySelectorAll(".post-ref a[href^='#reference-']"));
    var seenReferences = {};
    referenceLinks.forEach(function(refLink) {
      var href = refLink.getAttribute("href");
      if (!href || seenReferences[href]) return;
      seenReferences[href] = true;

      var refId = href.slice(1);
      var target = document.getElementById(refId);
      var sourceLink = null;

      if (target) {
        sourceLink = target.querySelector("a[href]");
      }
      if (!sourceLink) {
        var parent = refLink.closest("p, li, blockquote, h2, h3, h4");
        var candidates = parent ? Array.prototype.slice.call(parent.querySelectorAll("a[href]")) : [];
        sourceLink = candidates.filter(function(candidate) {
          return !candidate.closest(".post-ref");
        }).pop();
      }
      if (!sourceLink) return;

      var sidenote = document.createElement("div");
      var label = document.createElement("span");
      var link = sourceLink.cloneNode(true);

      sidenote.className = "sidenote";
      sidenote.setAttribute("data-reference-id", refId);
      label.className = "sidenote-label";
      label.textContent = refLink.textContent.replace(/\[|\]/g, "");
      link.removeAttribute("id");

      sidenote.appendChild(label);
      sidenote.appendChild(link);
      sidenotes.appendChild(sidenote);
      addedNotes += 1;
    });

    if (!addedNotes) {
      var title = sidenotes.querySelector("h4");
      if (title) title.remove();
    }
  }

  var tocLinks = Array.prototype.slice.call(document.querySelectorAll(".toc a[href^='#']"));
  if (!tocLinks.length || !("IntersectionObserver" in window)) return;

  var headings = tocLinks.map(function(link) {
    var id = decodeURIComponent(link.getAttribute("href").slice(1));
    try {
      return document.getElementById(id);
    } catch (err) {
      return null;
    }
  }).filter(Boolean);

  if (!headings.length) return;

  var observer = new IntersectionObserver(function(entries) {
    var visible = entries.filter(function(entry) {
      return entry.isIntersecting;
    }).sort(function(a, b) {
      return a.boundingClientRect.top - b.boundingClientRect.top;
    })[0];

    if (!visible) return;

    tocLinks.forEach(function(link) {
      link.classList.toggle("active", link.getAttribute("href") === "#" + visible.target.id);
    });
  }, {
    rootMargin: "0px 0px -70% 0px",
    threshold: 0.1
  });

  headings.forEach(function(heading) {
    observer.observe(heading);
  });
});
