import { useEffect, useState, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchUiItems } from "../api/uiItems";
import type { UiItem } from "../types";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export const UiDesign = () => {
  const { data } = useQuery({
    queryKey: ["ui-items"],
    queryFn: () => fetchUiItems(),
    select: (res: any) => res.data as UiItem[],
  });

  const [visibleItems, setVisibleItems] = useState<UiItem[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState("all");

  const sectionRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const loaderRef = useRef<HTMLDivElement | null>(null);

  // Category scroll row refs/state
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Drag state (kept in a ref so it doesn't trigger re-renders)
  const dragState = useRef({
    isDown: false,
    startX: 0,
    scrollLeft: 0,
    moved: false,
  });

  // Use arrays for line refs
  const horizLinesRef = useRef<(HTMLHRElement | null)[]>([]);
  const vertLinesRef = useRef<(HTMLHRElement | null)[]>([]);

  const itemsPerPage = 6;

  // categoryLabels/categories must be declared BEFORE any hook that references them
  const categoryLabels: Record<string, string> = {
    all: "All",
    "business-services": "Business Services",
    "education-books": "Education",
    "defense-security": "Defense/Security",
    travel: "Travel",
    entertainment: "Entertainment",
    "food-restaurant": "Food/Restaurant",
    "cars-motorcycles": "Cars/Motorcycles",
    "fashion-beauty": "Fashion/Beauty",
    electronics: "Electronics",
    "it-tech": "IT/Tech",
    "medical-healthcare": "Medical/Healthcare",
    "real-estate": "Real Estate",
    "society-people": "Society/People",
    "sports-outdoors-travel": "Sports",
    others: "Others",
  };
  const categories: string[] = Object.keys(categoryLabels);

  const filteredData =
    selectedCategory === "all"
      ? data || []
      : (data || []).filter((item) => item.category === selectedCategory);

  const loadMoreItems = useCallback(async () => {
    if (!filteredData || loadingMore || currentIndex >= filteredData.length)
      return;

    const nextBatch = filteredData.slice(
      currentIndex,
      currentIndex + itemsPerPage,
    );

    // FIX: Use Cloudinary transformations directly to avoid Microlink 429 errors
    const updatedItems = nextBatch.map((item) => {
      if (item.image?.includes("cloudinary.com")) {
        return {
          ...item,
          image: item.image.replace(
            "/upload/",
            "/upload/f_auto,q_auto,w_800,c_limit/",
          ),
        };
      }
      return item;
    });

    setVisibleItems((prev) => [...prev, ...updatedItems]);
    setCurrentIndex((prev) => prev + itemsPerPage);
    setLoadingMore(false);

    // Tell ScrollTrigger to recalculate page height
    setTimeout(() => ScrollTrigger.refresh(), 100);
  }, [filteredData, currentIndex, loadingMore]);

  // ---- Category row: scroll button visibility ----
  const updateScrollButtons = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  const scrollByAmount = (amount: number) => {
    scrollContainerRef.current?.scrollBy({ left: amount, behavior: "smooth" });
  };

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    updateScrollButtons();
    el.addEventListener("scroll", updateScrollButtons);
    window.addEventListener("resize", updateScrollButtons);

    return () => {
      el.removeEventListener("scroll", updateScrollButtons);
      window.removeEventListener("resize", updateScrollButtons);
    };
  }, [updateScrollButtons, categories.length]);

  // ---- Category row: mouse drag-to-scroll ----
  const handleMouseDown = (e: React.MouseEvent) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    dragState.current.isDown = true;
    dragState.current.moved = false;
    dragState.current.startX = e.pageX - el.offsetLeft;
    dragState.current.scrollLeft = el.scrollLeft;
    el.classList.add("cursor-grabbing");
    el.classList.remove("cursor-grab");
  };

  const handleMouseLeaveOrUp = () => {
    const el = scrollContainerRef.current;
    dragState.current.isDown = false;
    el?.classList.remove("cursor-grabbing");
    el?.classList.add("cursor-grab");
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const el = scrollContainerRef.current;
    if (!el || !dragState.current.isDown) return;
    e.preventDefault();
    const x = e.pageX - el.offsetLeft;
    const walk = (x - dragState.current.startX) * 1.5; // drag speed multiplier
    if (Math.abs(walk) > 3) dragState.current.moved = true;
    el.scrollLeft = dragState.current.scrollLeft - walk;
  };

  // Prevent the click-through on a button when the user was actually dragging
  const handleCategoryClick = (category: string) => {
    if (dragState.current.moved) return;
    setSelectedCategory(category);
  };

  useEffect(() => {
    if (visibleItems.length === 0 || !sectionRef.current) return;

    let ctx = gsap.context(() => {
      const hLines = horizLinesRef.current.filter(Boolean);
      const vLines = vertLinesRef.current.filter(Boolean);

      gsap.set(titleRef.current, { opacity: 0, y: 30 });

      gsap.set(".ui-card", {
        opacity: 0,
        x: 0,
        y: (i) => (i < 3 ? -30 : 30),
      });

      gsap.set(hLines, { scaleX: 0, transformOrigin: "left" });
      gsap.set(vLines, { scaleY: 0, transformOrigin: "top" });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 80%",
          end: "bottom 50%",
          scrub: 1,
        },
        defaults: { duration: 1, ease: "power2.out" },
      });

      tl.to(titleRef.current, { opacity: 1, y: 0 }, 0);

      tl.to(
        ".ui-card",
        {
          opacity: 1,
          x: 0,
          y: 0,
          stagger: { each: 0.1, from: "start" },
        },
        0.3,
      );

      tl.to(hLines, { scaleX: 1, stagger: 0.2, duration: 0.5 }, 0.8);
      tl.to(vLines, { scaleY: 1, stagger: 0.2, duration: 0.5 }, 1.2);
    }, sectionRef);

    return () => ctx.revert();
  }, [visibleItems]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMoreItems();
      },
      { rootMargin: "300px" },
    );

    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [loadMoreItems]);

  useEffect(() => {
    setVisibleItems([]);
    setCurrentIndex(0);
  }, [selectedCategory]);

  useEffect(() => {
    if (filteredData && filteredData.length > 0 && visibleItems.length === 0) {
      loadMoreItems();
    }
  }, [filteredData, visibleItems.length, loadMoreItems]);

  return (
    <section ref={sectionRef} className="bg-white text-gray-900 py-20 px-4">
      {/* Sticky Header with Horizontal Scroll for categories */}
      <div className="sticky top-0 z-50 bg-white py-6">
        <h2 ref={titleRef} className="text-center text-4xl font-serif mb-8">
          Selected UI Designs
        </h2>

        <div className="px-4 pb-2">
          <div
            ref={scrollContainerRef}
            onMouseDown={handleMouseDown}
            onMouseLeave={handleMouseLeaveOrUp}
            onMouseUp={handleMouseLeaveOrUp}
            onMouseMove={handleMouseMove}
            className="overflow-x-auto scrollbar-hide cursor-grab select-none"
            style={{ scrollBehavior: "smooth" }}
          >
            <div className="flex flex-nowrap justify-start min-w-max xl:flex-wrap xl:justify-center xl:min-w-0 gap-3">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => handleCategoryClick(category)}
                  className={`px-5 py-2 rounded-full whitespace-nowrap text-lg transition-all duration-300 ${selectedCategory === category
                      ? "bg-black text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                >
                  {categoryLabels[category] || category}
                </button>
              ))}
            </div>
          </div>

          {/* ARROW BUTTONS BELOW THE ROW */}
          {(canScrollLeft || canScrollRight) && (
            <div className="flex xl:hidden justify-end gap-4 mt-3">
              <button
                onClick={() => scrollByAmount(-240)}
                disabled={!canScrollLeft}
                className="h-8 w-8 flex items-center justify-center rounded-full bg-white shadow-md border border-gray-200 hover:bg-gray-100 transition disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white"
                aria-label="Scroll categories left"
              >
                ‹
              </button>
              <button
                onClick={() => scrollByAmount(240)}
                disabled={!canScrollRight}
                className="h-8 w-8 flex items-center justify-center rounded-full bg-white shadow-md border border-gray-200 hover:bg-gray-100 transition disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white"
                aria-label="Scroll categories right"
              >
                ›
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="relative max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 mt-8">
        {visibleItems.map((item, index) => (
          <div
            key={`${item._id}-${index}`}
            className="ui-card relative group p-10"
          >
            {/* HOVER POPUP */}
            <div className="absolute bottom-10 left-10 right-10 flex flex-col items-center justify-center p-4 bg-gray-900 text-white z-0 opacity-0 transition-all duration-500 ease-in-out translate-y-0 group-hover:translate-y-4 group-hover:opacity-100 rounded-b-lg">
              <h3 className="font-serif font-bold italic text-lg text-center">
                <a href={item.link} target="_blank" rel="noopener noreferrer">
                  {item.title}
                </a>
              </h3>
            </div>

            {/* MAIN IMAGE CONTAINER */}
            <div className="relative z-10 bg-white transition-transform duration-500 ease-out group-hover:-translate-y-10">
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block aspect-video overflow-hidden shadow-xl border border-gray-100"
              >
                <img
                  src={item.image || "/placeholder.jpg"}
                  alt={item.title}
                  className="w-full h-full object-cover object-top"
                  loading="lazy"
                />
              </a>
            </div>

            {/* VERTICAL GRID LINES */}
            {index % 3 !== 2 && (
              <hr
                ref={(el) => {
                  vertLinesRef.current[index] = el;
                }}
                className="hidden lg:block absolute top-0 right-0 w-[2px] h-full bg-black border-0 z-20"
              />
            )}

            {/* HORIZONTAL GRID LINES */}
            {index < visibleItems.length - 3 && (
              <hr
                ref={(el) => {
                  horizLinesRef.current[index] = el;
                }}
                className="hidden lg:block absolute bottom-0 left-[10%] w-[80%] h-[2px] bg-black border-0 z-20"
              />
            )}
          </div>
        ))}
      </div>

      {/* INFINITE SCROLL LOADER */}
      <div ref={loaderRef} className="text-center py-24">
        {loadingMore && (
          <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-black border-t-transparent"></div>
        )}
      </div>
    </section>
  );
};