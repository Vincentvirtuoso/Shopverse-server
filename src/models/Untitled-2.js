import { useState } from "react";

// Demo Component showing different use cases
const MultiInputDemo = () => {
  const [features, setFeatures] = useState([]);
  const [tags, setTags] = useState([]);
  const [keywords, setKeywords] = useState([]);
  const [categories, setCategories] = useState([]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-3">
            Multi-Input Component Demo
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            A highly reusable component for tags, features, keywords, and more
          </p>
        </div>

        {/* Features Example */}

        {/* Tags Example */}

        {/* Keywords Example */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
          <MultiInput
            label="SEO Keywords"
            name="keywords"
            value={keywords}
            onChange={setKeywords}
            placeholder="Enter SEO keywords..."
            mode="individual"
            allowModeSwitch={true}
            maxItems={20}
            minItems={5}
            maxLength={50}
            helperText="Add relevant keywords to improve search engine visibility"
            suggestions={[
              "smartphone",
              "mobile phone",
              "5G device",
              "android phone",
              "latest technology",
            ]}
            required={true}
            icon="hash"
            validateItem={(item) => {
              if (item.includes("  ")) return "No double spaces allowed";
              if (!/^[a-zA-Z0-9\s-]+$/.test(item))
                return "Only letters, numbers, spaces, and hyphens allowed";
              return null;
            }}
            styling={{
              primaryColor: "green",
              numberBadgeGradient: "from-green-500 to-green-600",
            }}
          />
        </div>

        {/* Categories Example */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
          <MultiInput
            label="Product Categories"
            name="categories"
            value={categories}
            onChange={setCategories}
            placeholder="Select or type categories..."
            mode="individual"
            allowModeSwitch={false}
            maxItems={5}
            minItems={1}
            maxLength={40}
            helperText="Choose up to 5 categories that best describe your product"
            suggestions={[
              "Electronics",
              "Home & Garden",
              "Fashion",
              "Sports & Outdoors",
              "Books",
              "Toys & Games",
              "Health & Beauty",
              "Automotive",
            ]}
            required={true}
            icon="list"
            emptyStateMessage="No categories selected. Choose from suggestions or add your own."
            styling={{
              primaryColor: "red",
              numberBadgeGradient: "from-red-500 to-pink-500",
            }}
          />
        </div>

        {/* Summary */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Current Values Summary
          </h3>
          <div className="space-y-3 text-sm">
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">
                Features:
              </span>
              <span className="ml-2 text-gray-600 dark:text-gray-400">
                {features.length > 0 ? features.join(", ") : "None"}
              </span>
            </div>
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">
                Tags:
              </span>
              <span className="ml-2 text-gray-600 dark:text-gray-400">
                {tags.length > 0 ? tags.join(", ") : "None"}
              </span>
            </div>
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">
                Keywords:
              </span>
              <span className="ml-2 text-gray-600 dark:text-gray-400">
                {keywords.length > 0 ? keywords.join(", ") : "None"}
              </span>
            </div>
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">
                Categories:
              </span>
              <span className="ml-2 text-gray-600 dark:text-gray-400">
                {categories.length > 0 ? categories.join(", ") : "None"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MultiInputDemo;
